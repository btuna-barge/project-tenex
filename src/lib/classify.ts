import Anthropic from "@anthropic-ai/sdk";
import type { GmailThread, Bucket, Classification } from "@/types";

const client = new Anthropic();

const BATCH_SIZE = 10;
const MODEL = "claude-sonnet-4-6";

function buildSystemPrompt(buckets: Bucket[]): string {
  const bucketList = buckets
    .map((b) => `- "${b.id}" (${b.label}): ${b.description}`)
    .join("\n");

  return `You are an email triage assistant. Your job is to classify email threads into exactly one bucket based on the sender, subject line, snippet, and Gmail labels.

Available buckets:
${bucketList}

Rules:
1. Classify EVERY thread. Use ONLY the bucket IDs listed above. Never invent new IDs.
2. Return a confidence score (0.0-1.0) and one-sentence reasoning for each.

How to decide:
- If the "From" is a person's name (e.g. "Sarah Chen <sarah@company.com>", "Tom Bradley <tom.b@company.com>") and they are asking you to do something, reply, review, approve, or show up → **important**
- If it's a newsletter, digest, blog post, or weekly roundup from a publication → **newsletter**
- If it's a deal, discount, sale, marketing, or product announcement from a brand → **promotions**
- If it's an automated notification (CI build, shipping, receipt, calendar, deploy, password reset) → **auto-archive**
- If it's unsolicited junk, scam, phishing, or cold outreach → **spam**
- Everything else (FYI updates, government notices, civic mail, tool notifications, Slack/Jira/Confluence digests) → **can-wait**`;
}

function buildUserPrompt(threads: GmailThread[]): string {
  const threadDescriptions = threads
    .map(
      (t, i) =>
        `Thread ${i + 1}:
  thread_id: ${t.id}
  from: ${t.from}
  subject: ${t.subject}
  snippet: ${t.snippet}
  labels: ${t.labelIds.join(", ")}`
    )
    .join("\n\n");

  return `Classify these email threads:\n\n${threadDescriptions}`;
}

function buildTool(buckets: Bucket[]): Anthropic.Tool {
  return {
    name: "classify_emails",
    description: "Classify a batch of email threads into buckets",
    input_schema: {
      type: "object" as const,
      properties: {
        classifications: {
          type: "array",
          items: {
            type: "object",
            properties: {
              thread_id: { type: "string" },
              bucket_id: {
                type: "string",
                enum: buckets.map((b) => b.id),
              },
              confidence: { type: "number", minimum: 0, maximum: 1 },
              reasoning: { type: "string" },
            },
            required: ["thread_id", "bucket_id", "confidence", "reasoning"],
          },
        },
      },
      required: ["classifications"],
    },
  };
}

async function classifyBatch(
  threads: GmailThread[],
  buckets: Bucket[],
  retryCount = 0
): Promise<Classification[]> {
  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: buildSystemPrompt(buckets),
      tools: [buildTool(buckets)],
      tool_choice: { type: "tool", name: "classify_emails" },
      messages: [{ role: "user", content: buildUserPrompt(threads) }],
    });

    const toolUse = response.content.find(
      (block) => block.type === "tool_use"
    );

    if (!toolUse || toolUse.type !== "tool_use") {
      throw new Error("No tool_use block in response");
    }

    const input = toolUse.input as {
      classifications?: {
        thread_id: string;
        bucket_id: string;
        confidence: number;
        reasoning: string;
      }[];
    };

    if (!Array.isArray(input.classifications)) {
      throw new Error("Model returned no classifications array");
    }

    const validBucketIds = new Set(buckets.map((b) => b.id));

    const parsed: Classification[] = input.classifications.map((c) => ({
      threadId: String(c.thread_id),
      bucketId: validBucketIds.has(c.bucket_id) ? c.bucket_id : "unclassified",
      confidence: validBucketIds.has(c.bucket_id) ? c.confidence : 0,
      reasoning: c.reasoning,
    }));

    // Model sometimes returns fewer rows than input threads; align so every thread has a result.
    const byId = new Map(parsed.map((c) => [c.threadId, c]));
    return threads.map((t) => {
      const hit = byId.get(String(t.id));
      if (hit) return hit;
      return {
        threadId: t.id,
        bucketId: "unclassified" as const,
        confidence: 0,
        reasoning: "Model omitted this thread in batch output",
      };
    });
  } catch (error) {
    // Retry once, then skip
    if (retryCount < 1) {
      console.warn(`Classification batch failed, retrying...`, error);
      return classifyBatch(threads, buckets, retryCount + 1);
    }

    console.error(`Classification batch failed after retry, skipping`, error);
    // Return unclassified for all threads in this batch
    return threads.map((t) => ({
      threadId: t.id,
      bucketId: "unclassified",
      confidence: 0,
      reasoning: "Classification failed after retry",
    }));
  }
}

const MAX_CONCURRENT = 5;

export async function classifyThreads(
  threads: GmailThread[],
  buckets: Bucket[]
): Promise<Classification[]> {
  // Split into batches of BATCH_SIZE
  const batches: GmailThread[][] = [];
  for (let i = 0; i < threads.length; i += BATCH_SIZE) {
    batches.push(threads.slice(i, i + BATCH_SIZE));
  }

  // Process batches with limited concurrency to avoid rate limits
  const results: Classification[][] = [];
  for (let i = 0; i < batches.length; i += MAX_CONCURRENT) {
    const chunk = batches.slice(i, i + MAX_CONCURRENT);
    const chunkResults = await Promise.all(
      chunk.map((batch) => classifyBatch(batch, buckets))
    );
    results.push(...chunkResults);
  }

  const all = results.flat();

  // Retry any threads the model dropped (marked unclassified with 0 confidence)
  const dropped = all.filter(
    (c) => c.bucketId === "unclassified" && c.confidence === 0
  );
  if (dropped.length > 0 && dropped.length <= BATCH_SIZE) {
    const droppedThreads = threads.filter((t) =>
      dropped.some((d) => d.threadId === t.id)
    );
    if (droppedThreads.length > 0) {
      const retryResults = await classifyBatch(droppedThreads, buckets);
      const retryMap = new Map(retryResults.map((r) => [r.threadId, r]));
      for (let i = 0; i < all.length; i++) {
        const retry = retryMap.get(all[i].threadId);
        if (retry && retry.bucketId !== "unclassified") {
          all[i] = retry;
        }
      }
    }
  }

  return all;
}
