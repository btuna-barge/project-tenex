import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForTokens, getSession } from "@/lib/auth";

function isEmailAllowed(email: string): boolean {
  const allowlist = process.env.ALLOWED_EMAILS;
  if (!allowlist) return true; // no allowlist = open access
  const allowed = allowlist.split(",").map((e) => e.trim().toLowerCase());
  const normalised = email.toLowerCase();
  return allowed.some((entry) =>
    entry.startsWith("@")
      ? normalised.endsWith(entry) // domain match: @tenex.co
      : normalised === entry // exact match
  );
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(new URL("/?error=no_code", request.url));
  }

  try {
    const tokens = await exchangeCodeForTokens(code);

    // Decode the ID token to get email
    const payload = JSON.parse(
      Buffer.from(tokens.id_token.split(".")[1], "base64").toString()
    );

    if (!isEmailAllowed(payload.email)) {
      return NextResponse.redirect(new URL("/?error=not_allowed", request.url));
    }

    const session = await getSession();
    session.accessToken = tokens.access_token;
    session.refreshToken = tokens.refresh_token;
    session.expiresAt = Date.now() + tokens.expires_in * 1000;
    session.email = payload.email;
    await session.save();

    return NextResponse.redirect(new URL("/inbox", request.url));
  } catch (error) {
    console.error("OAuth callback error:", error);
    return NextResponse.redirect(new URL("/?error=auth_failed", request.url));
  }
}
