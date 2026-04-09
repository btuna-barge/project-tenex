import { NextRequest, NextResponse } from "next/server";
import { classifyThreads } from "@/lib/classify";
import { getValidAccessToken } from "@/lib/auth";
import type { GmailThread, Bucket } from "@/types";

export const maxDuration = 180;

export async function POST(request: NextRequest) {
  try {
    // Verify the user is authenticated before using Anthropic API
    await getValidAccessToken();

    const body = await request.json();
    const { threads, buckets } = body as {
      threads: GmailThread[];
      buckets: Bucket[];
    };

    if (!threads?.length || !buckets?.length) {
      return NextResponse.json(
        { error: "threads and buckets are required" },
        { status: 400 }
      );
    }

    const classifications = await classifyThreads(threads, buckets);
    return NextResponse.json({ classifications });
  } catch (error) {
    console.error("Classification error:", error);
    const message = error instanceof Error ? error.message : "Classification failed";
    if (message === "Not authenticated") {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    return NextResponse.json({ error: "Classification failed" }, { status: 500 });
  }
}
