# Inbox Concierge

AI-powered email triage that classifies your Gmail inbox into smart buckets using Claude.

Built as a take-home project for Tenex - demonstrates LLM classification pipeline design, structured output engineering, and feedback loop thinking.

**Repository:** [github.com/btuna-barge/project-tenex](https://github.com/btuna-barge/project-tenex)  
**Live demo:** [project-tenex.vercel.app](https://project-tenex.vercel.app) (Google sign-in; OAuth app must allow your Google account if the consent screen is in Testing mode)

## Features

- **Gmail OAuth2** - read-only access to your last 200 threads
- **AI Classification** - Claude Sonnet classifies threads into configurable buckets (Important, Can Wait, Newsletter, Promotions, Auto-archive, Spam)
- **Custom Buckets** - create your own categories with descriptions the LLM uses for classification; triggers automatic reclassification
- **Drag-and-Drop** - move threads between buckets (board view) and reorder buckets (both views)
- **Confidence Scoring** - per-thread confidence badges (green/yellow/red) and aggregate stats
- **Correction Tracking** - drag overrides are logged as feedback events; corrections count updates in real-time
- **List + Board Views** - toggle between a grouped list and kanban-style columns
- **Dark Mode** - full dark mode via semantic color tokens
- **Charts** - distribution donut and per-bucket confidence bar chart via Highcharts

## Quick Start

```bash
# 1. Clone and install
git clone https://github.com/btuna-barge/project-tenex.git
cd project-tenex
npm install

# 2. Configure environment
cp .env.example .env.local
# Fill in the values (see below)

# 3. Run
npm run dev
```

For **local** development, open [http://localhost:3000](http://localhost:3000) and sign in with Google (use the production link at the top of this file for the deployed app).

```bash
# Production parity check (optional)
npm run build && npm run start
```

### Environment Variables

Copy `.env.example` to `.env.local` for local development. For [Vercel](https://vercel.com), add the same keys under Project **Settings → Environment Variables** (use **Production** only unless you need Preview). Paste real values; do not commit `.env.local`.

| Variable | Description |
|----------|-------------|
| `GOOGLE_CLIENT_ID` | OAuth2 client ID from [GCP Console](https://console.cloud.google.com/apis/credentials) |
| `GOOGLE_CLIENT_SECRET` | OAuth2 client secret |
| `GOOGLE_REDIRECT_URI` | Local: `http://localhost:3000/api/auth/callback`. Production: `https://<your-domain>/api/auth/callback` (must match GCP **exactly**, including `https` and no trailing slash) |
| `SESSION_SECRET` | Random 32+ character string for encrypting session cookies |
| `ANTHROPIC_API_KEY` | API key from [console.anthropic.com](https://console.anthropic.com) |

### GCP Setup (local + production)

1. Create a project in Google Cloud Console.
2. Enable the **Gmail API**.
3. Configure the OAuth consent screen (External; add the `gmail.readonly` scope used by the app).
4. Create **OAuth 2.0 Client ID** credentials of type **Web application**.
5. **Authorized JavaScript origins:** add `http://localhost:3000` and your production origin (e.g. `https://project-tenex.vercel.app`).
6. **Authorized redirect URIs:** add **both**  
   - `http://localhost:3000/api/auth/callback`  
   - `https://<your-production-host>/api/auth/callback`  
   Use the **same** redirect string in `GOOGLE_REDIRECT_URI` for each environment (Vercel vs `.env.local`).
7. While the app is in **Testing**, add every Google account that should sign in under **Test users**.

**Seed script (optional, local only):** to insert ~200 demo threads into a mailbox, run `npx tsx scripts/seed-emails.ts`. It uses `.env.local` plus **separate** OAuth scopes (`gmail.insert`, `gmail.modify`) and redirect `http://localhost:3001/oauth/callback` — add that redirect URI to the **same** OAuth client if you use the script. Register `http://localhost:3001` under **Authorized JavaScript origins** as well. Optional env: `SEED_TO_EMAIL` (recipient; defaults are documented in the script).

### Deploy (Vercel)

1. Import this GitHub repo in Vercel.
2. Set the environment variables above for **Production** (`GOOGLE_REDIRECT_URI` must be the **https** production callback, not localhost).
3. Redeploy after changing variables.

## Architecture

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Framework | Next.js 16 (App Router) | React frontend + API routes |
| LLM | Claude Sonnet 4.6 (`@anthropic-ai/sdk`) | Thread classification via `tool_use` |
| Auth | Google OAuth2 + `iron-session` | Encrypted cookie sessions, token refresh |
| Styling | Tailwind CSS v4 + shadcn/ui | Semantic tokens, dark mode |
| Drag & Drop | `@dnd-kit/core` + `@dnd-kit/sortable` | Thread moves + bucket reordering |
| Charts | Highcharts | Distribution and confidence visualization |

### Classification Pipeline

1. Fetch 200 most recent threads from Gmail API (batched metadata fetches, 50 at a time)
2. Split into 20 batches of 10 threads each
3. Fire batches to Claude Sonnet via `tool_use` structured output (max 5 concurrent to avoid rate limits)
4. Each response returns `{ bucket_id, confidence, reasoning }` per thread with enum-constrained `bucket_id`
5. Retry once on failure; mark as "unclassified" if second attempt fails
6. Cache results in `sessionStorage` to avoid re-classifying on page refresh

## Design Decisions

- **`tool_use` over raw JSON** - schema-validated structured output with enum constraints eliminates parsing errors and guarantees valid bucket IDs
- **Batch size of 10** - small enough for reliable output, large enough to keep total API calls manageable (20 batches, 5 concurrent to respect rate limits)
- **Retry-once-then-skip** - don't block the pipeline for one bad batch; show "unclassified" gracefully
- **Client-side state, no database** - simplest correct solution for a demo; `sessionStorage` caching prevents unnecessary API costs
- **Client-only feedback** - corrections tracked in React state via `useFeedback` hook; no server persistence needed for demo
- **Highcharts** - polished out-of-the-box styling, smooth animations, professional chart rendering for the demo
- **Raw OAuth over NextAuth** - single provider, need direct token access for Gmail API, simpler and more transparent

## What I'd Build Next

See [docs/design.md](docs/design.md) for the full roadmap, including:

- Export correction logs as DPO training pairs
- Active learning: surface low-confidence threads for user review
- Persistent storage + multi-session feedback aggregation
- Apply Gmail labels based on classification
- Prompt A/B testing against correction rate

## License

MIT
