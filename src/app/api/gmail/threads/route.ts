import { NextResponse } from "next/server";
import { getValidAccessToken } from "@/lib/auth";
import { fetchThreads } from "@/lib/gmail";

export const maxDuration = 30;

export async function GET() {
  try {
    const accessToken = await getValidAccessToken();
    const threads = await fetchThreads(accessToken);
    return NextResponse.json({ threads });
  } catch (error) {
    console.error("Gmail fetch error:", error);
    const message = error instanceof Error ? error.message : "Failed to fetch threads";
    if (message === "Not authenticated") {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
