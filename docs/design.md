# Inbox Concierge - Design Document

## Overview

Inbox Concierge classifies a user's 200 most recent Gmail threads into LLM-powered buckets using Claude Sonnet 4.6. The system is designed around principles from production classification pipelines: structured outputs, confidence scoring, graceful degradation, and feedback collection for model improvement.

## Classification Pipeline

### Architecture

```
Gmail API (200 threads)
    → Batch into groups of 10
    → Anthropic API calls, 5 concurrent (tool_use)
    → Merge results → Display in UI
```

### Why `tool_use` (Structured Output)

Instead of asking the LLM to produce raw JSON, we define a tool schema with:

- **`bucket_id`**: enum-constrained to valid bucket IDs - impossible to hallucinate an invalid category
- **`confidence`**: float 0-1 - forces the model to self-assess
- **`reasoning`**: string - provides transparency for debugging and user trust

This eliminates JSON parsing errors entirely. The Anthropic SDK validates the schema server-side before returning.

### Batching Strategy

- **Batch size: 10 threads per API call** - empirically the sweet spot between output reliability (smaller batches = more consistent structured output) and cost efficiency (fewer total API calls)
- **Parallelism: 5 batches at a time** via `Promise.all` with concurrency windowing - balances speed against Anthropic rate limits. Total classification completes in ~4 rounds (~15-20 seconds for 200 threads)
- **Token budget: 4096 max tokens** per batch response - sufficient for 10 classifications with reasoning

### Error Handling

- **Retry-once-then-skip**: if a batch fails (rate limit, malformed response, timeout), retry once with the same payload. If the second attempt fails, mark all threads in that batch as "unclassified" with 0% confidence
- **Why not retry more?** A single retry catches transient errors (rate limits, network blips). Persistent failures indicate a deeper issue (prompt too long, model confusion) that additional retries won't fix - better to degrade gracefully than block the UI

### Caching

Classifications are cached in `sessionStorage` after the initial run. On page refresh, the client checks if cached thread IDs match the current inbox. If they do, classifications are restored without an API call. This prevents unnecessary Anthropic API costs during development and demo usage.

Cache is invalidated when:
- The thread list changes (new emails arrive)
- A bucket is added or removed (triggers full reclassification)
- The user signs out (cache is cleared)

## Prompt Engineering

### System Prompt Structure

```
You are an email triage assistant. Your job is to classify email threads
into exactly one bucket based on the sender, subject line, snippet, and
Gmail labels.

Available buckets:
- "important" (Important): Direct messages requiring action...
- "can-wait" (Can Wait): Informational but not urgent...
- ...

Rules:
1. Every thread MUST be classified into exactly one bucket
2. Set confidence 0.0-1.0 based on how certain you are
3. Provide brief reasoning for each classification
```

Key design choices:
- **Bucket descriptions are first-class** - the LLM reads them to decide classification. When a user creates a custom bucket with a good description, classification quality is high
- **Confidence is explicitly requested** - without this, models tend to be overconfident. The 0-1 scale with instructions to be honest about uncertainty produces useful signal
- **Reasoning is required** - serves dual purpose: improves classification quality (chain-of-thought) and provides user-facing transparency

### Custom Buckets

When a user creates a custom bucket (e.g., "Job Applications: Emails related to job applications, recruiter outreach, interview scheduling"), the full taxonomy is rebuilt and all threads are reclassified. The LLM sees the new bucket alongside defaults and redistributes threads accordingly.

## Feedback System

### Current Implementation

The feedback system is intentionally minimal - client-only, no server persistence:

1. **Drag-and-drop corrections**: when a user moves a thread from bucket A to bucket B in board view, a `FeedbackEvent` is logged:
   ```typescript
   { threadId, predictedBucket, correctedBucket, confidence, timestamp }
   ```

2. **Metrics displayed**:
   - **Avg Confidence**: mean model confidence across all classified threads - a real signal about model certainty
   - **Corrections**: count of unique threads the user has manually reassigned - shows how often the model was wrong enough for the user to override

3. **Why not "Accuracy"?** The previous label "Accuracy: 100%" was misleading - it only meant "no user overrides", not "the model classified everything correctly." Avg confidence is a more honest and useful metric.

### Why Client-Only?

For a demo, server-side persistence adds complexity without value:
- No database to manage
- No API route to secure
- Feedback data lives as long as the session
- The architecture is designed so that adding persistence later is straightforward (the `FeedbackEvent` type is already defined, just needs a storage backend)

## Evaluation & Improvement Roadmap

If this were a production system, here's how the feedback loop would evolve:

### Phase 1: Export Training Pairs
Each drag correction creates a natural DPO (Direct Preference Optimization) training pair:
- **Rejected**: the model's classification (bucket A)
- **Chosen**: the user's correction (bucket B)
- **Context**: thread metadata (from, subject, snippet)

Export these as JSONL for fine-tuning.

### Phase 2: Active Learning
Surface low-confidence classifications for explicit user review:
- Threads with confidence < 0.6 get a "Review" badge
- User can confirm or correct with one click
- Confirmed classifications become positive training examples
- Corrections become negative examples

This targets the model's uncertainty, generating maximum-information training data per user interaction.

### Phase 3: RLVR (Reinforcement Learning from Verified Rewards)
Use verified corrections as a reward signal:
- Reward = 1 if user confirms classification
- Reward = 0 if user corrects classification
- Train a reward model on these signals
- Use the reward model to improve classification without explicit human feedback

### Phase 4: Prompt A/B Testing
Run multiple prompt variants against the same thread set:
- Measure correction rate per variant
- Automatically promote the best-performing prompt
- Track performance over time as email patterns change

### Phase 5: Confusion Matrix & Observability
- Build a confusion matrix from corrections: which buckets does the model most often confuse?
- Confidence calibration: are 90% confidence predictions actually correct 90% of the time?
- Per-bucket precision/recall to identify weak categories
- Alert when correction rate exceeds threshold

## Technology Choices

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Next.js over CRA/Vite | App Router gives us API routes + React in one repo; trivial Vercel deploy |
| iron-session over JWT | Encrypted cookie = no client-side token exposure; built-in expiry; simpler than JWT refresh logic |
| Raw OAuth over NextAuth | Single provider (Google), need direct `access_token` for Gmail API calls; NextAuth adds abstraction we'd have to fight |
| Claude Sonnet 4.6 over GPT-4/Haiku | Best cost/quality/speed balance for classification; tool_use support; Anthropic SDK is clean |
| @dnd-kit over react-beautiful-dnd | Actively maintained, supports both sortable (reorder) and droppable (move between containers), accessible |
| Highcharts over Recharts | Superior out-of-the-box styling, smooth animations, professional-grade charts; free for non-commercial/personal use |
| sessionStorage over localStorage | Scoped to tab, auto-cleared on close - appropriate for demo data that shouldn't persist indefinitely |

## What I'd Build With More Time

1. **Thread detail view** - click to expand full email body, reply preview
2. **Gmail label sync** - apply bucket labels back to Gmail via `gmail.modify`
3. **Persistent storage** - PostgreSQL or Supabase for cross-session feedback aggregation
4. **Multi-account** - support multiple Gmail accounts in one view
5. **Batch Gmail API** - use Google's batch endpoint instead of individual `threads.get` calls
6. **Progressive rendering** - show classified threads as each batch resolves instead of waiting for all 20
7. **Keyboard shortcuts** - vim-style navigation (j/k for threads, 1-6 for bucket assignment)
8. **Export** - download classifications as CSV for analysis
