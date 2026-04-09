"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LoginButton } from "@/components/auth/login-button";

export default function Home() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    }>
      <HomeContent />
    </Suspense>
  );
}

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [checking, setChecking] = useState(true);
  const error = searchParams.get("error");

  useEffect(() => {
    fetch("/api/auth/session")
      .then((res) => res.json())
      .then((data) => {
        if (data.authenticated) {
          router.replace("/inbox");
        } else {
          setChecking(false);
        }
      })
      .catch(() => setChecking(false));
  }, [router]);

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-4">
      <div className="text-center space-y-4 max-w-lg">
        <h1 className="text-4xl font-bold tracking-tight">Inbox Concierge</h1>
        <p className="text-lg text-muted-foreground">
          AI-powered email triage. Classify your last 200 threads into smart
          buckets, create your own categories, and take control of your inbox.
        </p>
      </div>
      {error === "not_allowed" && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-3 text-sm text-destructive max-w-sm text-center">
          Access is currently limited to approved accounts. Watch the demo video to see the full experience.
        </div>
      )}
      <LoginButton />
      <div className="text-center text-xs text-muted-foreground max-w-sm space-y-1">
        <p>Connects to Gmail with read-only access.</p>
        <p>
          Email metadata (sender, subject, snippet) is sent to Anthropic&apos;s
          Claude API for classification. No email content is stored or persisted.
        </p>
      </div>
    </div>
  );
}
