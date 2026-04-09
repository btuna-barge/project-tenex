"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useInbox } from "@/hooks/use-inbox";
import { useFeedback } from "@/hooks/use-feedback";
import { ThreadList } from "@/components/inbox/thread-list";
import { BucketBoard } from "@/components/inbox/bucket-board";
import { BucketManager } from "@/components/inbox/bucket-manager";
import { LoadingSkeleton } from "@/components/inbox/loading-skeleton";
import { BucketSidebar } from "@/components/inbox/bucket-sidebar";
import { Button } from "@/components/ui/button";
import type { Bucket } from "@/types";

type ViewMode = "list" | "board";

export default function InboxContent() {
  const router = useRouter();
  const [view, setView] = useState<ViewMode>("list");
  const [session, setSession] = useState<{ email: string } | null>(null);
  const [darkMode, setDarkMode] = useState(false);
  const [activeBucketFilter, setActiveBucketFilter] = useState<string | null>(null);

  const {
    threads,
    buckets,
    classifications,
    loading,
    classifying,
    error,
    fetchThreads,
    classifyAll,
    addBucket,
    removeBucket,
    editBucket,
    restoreFromCache,
    reorderBuckets,
    moveThread,
    getThreadsByBucket,
    getUnclassifiedThreads,
  } = useInbox();

  // Always classify with latest threads/buckets — stale [] threads wipes the map (all "unclassified").
  const threadsRef = useRef(threads);
  const bucketsRef = useRef(buckets);
  threadsRef.current = threads;
  bucketsRef.current = buckets;

  const classifiedCount = Array.from(classifications.values()).filter(
    (c) => c.bucketId !== "unclassified"
  ).length;

  const { logCorrection, accuracy } = useFeedback(classifiedCount);

  const avgConfidence = useMemo(() => {
    const classified = Array.from(classifications.values()).filter(
      (c) => c.bucketId !== "unclassified"
    );
    if (classified.length === 0) return 0;
    return classified.reduce((sum, c) => sum + c.confidence, 0) / classified.length;
  }, [classifications]);

  // Dark mode
  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
  }, [darkMode]);

  // Cache classifications in sessionStorage
  useEffect(() => {
    if (classifications.size > 0) {
      const data = Object.fromEntries(classifications);
      sessionStorage.setItem("inbox-classifications", JSON.stringify(data));
      sessionStorage.setItem("inbox-buckets", JSON.stringify(buckets));
    }
  }, [classifications, buckets]);

  // Check auth and load threads
  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/session")
      .then((res) => res.json())
      .then(async (data) => {
        if (cancelled) return;
        if (!data.authenticated) {
          router.replace("/");
          return;
        }
        setSession({ email: data.email });

        const fetchedThreads = await fetchThreads();
        if (!fetchedThreads || fetchedThreads.length === 0) return;

        // Try cache first
        const cachedClassifications = sessionStorage.getItem("inbox-classifications");
        if (cachedClassifications) {
          try {
            const parsed = JSON.parse(cachedClassifications);
            const cachedIds = new Set(Object.keys(parsed));
            const currentIds = fetchedThreads.map((t: { id: string }) => t.id);
            const allCached = currentIds.every((id: string) => cachedIds.has(id));

            if (allCached) {
              const { DEFAULT_BUCKETS } = await import("@/lib/buckets");
              const cachedBuckets = sessionStorage.getItem("inbox-buckets");
              const bucketsToUse = cachedBuckets ? JSON.parse(cachedBuckets) : DEFAULT_BUCKETS;
              restoreFromCache(parsed, bucketsToUse);
              return;
            }
          } catch {
            // fall through
          }
        }

        const { DEFAULT_BUCKETS } = await import("@/lib/buckets");
        await classifyAll(fetchedThreads, DEFAULT_BUCKETS);
      })
      .catch(() => { if (!cancelled) router.replace("/"); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAddBucket = useCallback(
    async (bucket: Bucket) => {
      addBucket(bucket);
      const prevBuckets = bucketsRef.current;
      const newBuckets = [...prevBuckets, { ...bucket, isCustom: true }];
      const toClassify = threadsRef.current;
      if (toClassify.length === 0) return;
      await classifyAll(toClassify, newBuckets);
    },
    [addBucket, classifyAll]
  );

  const handleRemoveBucket = useCallback(
    async (bucketId: string) => {
      if (activeBucketFilter === bucketId) setActiveBucketFilter(null);
      removeBucket(bucketId);
      const newBuckets = bucketsRef.current.filter((b) => b.id !== bucketId);
      const toClassify = threadsRef.current;
      if (toClassify.length === 0) return;
      await classifyAll(toClassify, newBuckets);
    },
    [removeBucket, classifyAll, activeBucketFilter]
  );

  const handleEditBucket = useCallback(
    async (
      bucketId: string,
      updates: { label: string; description: string; color: string }
    ) => {
      editBucket(bucketId, updates);
      const newBuckets = bucketsRef.current.map((b) =>
        b.id === bucketId ? { ...b, ...updates } : b
      );
      const toClassify = threadsRef.current;
      if (toClassify.length === 0) return;
      await classifyAll(toClassify, newBuckets);
    },
    [editBucket, classifyAll]
  );

  const handleMoveThread = useCallback(
    (threadId: string, fromBucket: string, toBucket: string, confidence: number) => {
      moveThread(threadId, toBucket);
      logCorrection(threadId, fromBucket, toBucket, confidence);
    },
    [moveThread, logCorrection]
  );

  const handleLogout = async () => {
    sessionStorage.removeItem("inbox-classifications");
    sessionStorage.removeItem("inbox-buckets");
    await fetch("/api/auth/session", { method: "DELETE" });
    router.replace("/");
  };

  const displayBuckets =
    activeBucketFilter === "unclassified"
      ? []
      : activeBucketFilter
        ? buckets.filter((b) => b.id === activeBucketFilter)
        : buckets;

  const hideUnclassifiedInMain =
    Boolean(activeBucketFilter) && activeBucketFilter !== "unclassified";

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border px-6 py-3 flex items-center gap-4 bg-card">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <svg className="w-4 h-4 text-primary-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="font-bold text-lg text-foreground">Inbox Concierge</h1>
        </div>

        {classifiedCount > 0 && !classifying && (
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
            <div className={`w-1.5 h-1.5 rounded-full ${avgConfidence >= 0.85 ? "bg-green-500" : avgConfidence >= 0.6 ? "bg-yellow-500" : "bg-red-500"}`} />
            {Math.round(avgConfidence * 100)}% avg confidence
          </div>
        )}

        <div className="ml-auto flex items-center gap-3">
          {/* Dark mode */}
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground"
            aria-label="Toggle dark mode"
          >
            {darkMode ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>

          {/* View toggle */}
          <div className="flex rounded-lg border border-border overflow-hidden bg-muted">
            <button
              onClick={() => setView("list")}
              aria-label="List view"
              className={`px-3 py-1.5 transition-colors ${
                view === "list"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <button
              onClick={() => setView("board")}
              aria-label="Board view"
              className={`px-3 py-1.5 transition-colors ${
                view === "board"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
              </svg>
            </button>
          </div>

          <BucketManager onAddBucket={handleAddBucket} />

          {session && (
            <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-semibold text-primary">
                {session.email.charAt(0).toUpperCase()}
              </div>
            </div>
          )}
          <Button variant="ghost" size="sm" className="text-xs" onClick={handleLogout}>
            Sign out
          </Button>
        </div>
      </header>

      {/* Status bar */}
      {(loading || classifying) && (
        <div className="bg-accent border-b border-border px-6 py-2 text-sm text-accent-foreground flex items-center gap-2" role="status" aria-live="polite">
          <div className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          {loading
            ? "Fetching emails from Gmail..."
            : `Classifying ${threads.length} threads into ${buckets.length} buckets...`}
        </div>
      )}

      {error && (
        <div className="bg-destructive/10 border-b border-destructive/20 px-6 py-2 text-sm text-destructive flex items-center gap-2">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </div>
      )}

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <BucketSidebar
          buckets={buckets}
          activeBucketFilter={activeBucketFilter}
          onFilterChange={setActiveBucketFilter}
          onReorder={reorderBuckets}
          onRemove={handleRemoveBucket}
          onEdit={handleEditBucket}
          getCount={(id) => getThreadsByBucket(id).length}
          getUnclassifiedThreads={getUnclassifiedThreads}
          totalThreads={threads.length}
          classifiedCount={classifiedCount}
          avgConfidence={avgConfidence}
          corrections={accuracy.total - accuracy.accepted}
          classifications={classifications}
          getThreadsByBucket={getThreadsByBucket}
        />

        {/* Content */}
        <main className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto bg-background">
          {loading ? (
            <LoadingSkeleton count={15} />
          ) : view === "list" ? (
            <ThreadList
              threads={threads}
              buckets={displayBuckets}
              classifications={classifications}
              getThreadsByBucket={getThreadsByBucket}
              getUnclassifiedThreads={hideUnclassifiedInMain ? () => [] : getUnclassifiedThreads}
              onRemoveBucket={handleRemoveBucket}
              onEditBucket={handleEditBucket}
            />
          ) : (
            <BucketBoard
              buckets={displayBuckets}
              threads={threads}
              classifications={classifications}
              getThreadsByBucket={getThreadsByBucket}
              getUnclassifiedThreads={hideUnclassifiedInMain ? () => [] : getUnclassifiedThreads}
              onMoveThread={handleMoveThread}
              onReorderBuckets={reorderBuckets}
              onRemoveBucket={handleRemoveBucket}
              onEditBucket={handleEditBucket}
            />
          )}
        </main>
      </div>
    </div>
  );
}
