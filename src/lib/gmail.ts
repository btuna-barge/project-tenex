import type { GmailThread } from "@/types";

const GMAIL_API = "https://gmail.googleapis.com/gmail/v1/users/me";

export async function fetchThreads(accessToken: string): Promise<GmailThread[]> {
  // Step 1: List thread IDs (most recent 200)
  const listRes = await fetch(
    `${GMAIL_API}/threads?maxResults=200`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!listRes.ok) {
    throw new Error(`Gmail list threads failed: ${listRes.status}`);
  }

  const listData = await listRes.json();
  const threadIds: string[] = (listData.threads || []).map(
    (t: { id: string }) => t.id
  );

  if (threadIds.length === 0) return [];

  // Step 2: Fetch metadata for each thread in parallel batches of 50
  const BATCH_SIZE = 50;
  const threads: GmailThread[] = [];

  for (let i = 0; i < threadIds.length; i += BATCH_SIZE) {
    const batch = threadIds.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map((id) => fetchThreadMetadata(id, accessToken))
    );
    threads.push(...results.filter((t): t is GmailThread => t !== null));
  }

  return threads;
}

async function fetchThreadMetadata(
  threadId: string,
  accessToken: string,
  retry = true
): Promise<GmailThread | null> {
  try {
    const res = await fetch(
      `${GMAIL_API}/threads/${threadId}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!res.ok) {
      if (retry && (res.status === 429 || res.status >= 500)) {
        await new Promise((r) => setTimeout(r, 200));
        return fetchThreadMetadata(threadId, accessToken, false);
      }
      return null;
    }

    const data = await res.json();
    const latestMessage = data.messages?.[data.messages.length - 1];
    if (!latestMessage) return null;

    const headers = latestMessage.payload?.headers || [];
    const getHeader = (name: string) =>
      headers.find((h: { name: string; value: string }) =>
        h.name.toLowerCase() === name.toLowerCase()
      )?.value || "";

    return {
      id: data.id,
      subject: getHeader("Subject") || "(no subject)",
      snippet: data.snippet || "",
      from: getHeader("From"),
      date: getHeader("Date"),
      messageCount: data.messages?.length || 1,
      labelIds: latestMessage.labelIds || [],
    };
  } catch {
    return null;
  }
}
