"use client";

import { useState, useCallback } from "react";
import type { GmailThread, Bucket, Classification } from "@/types";
import { DEFAULT_BUCKETS } from "@/lib/buckets";

interface InboxState {
  threads: GmailThread[];
  buckets: Bucket[];
  classifications: Map<string, Classification>;
  loading: boolean;
  classifying: boolean;
  error: string | null;
}

export function useInbox() {
  const [state, setState] = useState<InboxState>({
    threads: [],
    buckets: DEFAULT_BUCKETS,
    classifications: new Map(),
    loading: false,
    classifying: false,
    error: null,
  });

  const fetchThreads = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const res = await fetch("/api/gmail/threads");
      if (!res.ok) {
        if (res.status === 401) {
          window.location.href = "/";
          return;
        }
        throw new Error("Failed to fetch threads");
      }

      const data = await res.json();
      setState((prev) => ({ ...prev, threads: data.threads, loading: false }));
      return data.threads as GmailThread[];
    } catch (error) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : "Failed to fetch threads",
      }));
      return [];
    }
  }, []);

  const classifyAll = useCallback(
    async (threads: GmailThread[], buckets: Bucket[]) => {
      setState((prev) => ({ ...prev, classifying: true, error: null }));

      try {
        const res = await fetch("/api/classify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ threads, buckets }),
        });

        if (!res.ok) throw new Error("Classification failed");

        const data = await res.json();
        const list = data.classifications as Classification[] | undefined;
        if (!Array.isArray(list)) {
          throw new Error("Classification failed");
        }
        if (threads.length > 0 && list.length === 0) {
          throw new Error("Classification failed");
        }

        const classificationsMap = new Map<string, Classification>();
        for (const c of list) {
          classificationsMap.set(c.threadId, c);
        }

        setState((prev) => ({
          ...prev,
          classifications: classificationsMap,
          classifying: false,
        }));
      } catch (error) {
        setState((prev) => ({
          ...prev,
          classifying: false,
          error:
            error instanceof Error ? error.message : "Classification failed",
        }));
      }
    },
    []
  );

  const addBucket = useCallback((bucket: Bucket) => {
    setState((prev) => ({
      ...prev,
      buckets: [...prev.buckets, { ...bucket, isCustom: true }],
    }));
  }, []);

  const removeBucket = useCallback((bucketId: string) => {
    setState((prev) => ({
      ...prev,
      buckets: prev.buckets.filter((b) => b.id !== bucketId),
    }));
  }, []);

  const editBucket = useCallback(
    (bucketId: string, updates: Partial<Pick<Bucket, "label" | "description" | "color">>) => {
      setState((prev) => ({
        ...prev,
        buckets: prev.buckets.map((b) =>
          b.id === bucketId ? { ...b, ...updates } : b
        ),
      }));
    },
    []
  );

  const reorderBuckets = useCallback((newBuckets: Bucket[]) => {
    setState((prev) => ({ ...prev, buckets: newBuckets }));
  }, []);

  const restoreFromCache = useCallback(
    (
      cachedClassifications: Record<string, Classification>,
      cachedBuckets: Bucket[]
    ) => {
      const map = new Map<string, Classification>();
      for (const [key, val] of Object.entries(cachedClassifications)) {
        map.set(key, val);
      }
      setState((prev) => ({
        ...prev,
        classifications: map,
        buckets: cachedBuckets,
        classifying: false,
      }));
    },
    []
  );

  const moveThread = useCallback(
    (threadId: string, newBucketId: string) => {
      setState((prev) => {
        const newClassifications = new Map(prev.classifications);
        const existing = newClassifications.get(threadId);
        if (existing) {
          newClassifications.set(threadId, {
            ...existing,
            bucketId: newBucketId,
          });
        }
        return { ...prev, classifications: newClassifications };
      });
    },
    []
  );

  const getThreadsByBucket = useCallback(
    (bucketId: string): GmailThread[] => {
      return state.threads.filter((t) => {
        const classification = state.classifications.get(t.id);
        return classification?.bucketId === bucketId;
      });
    },
    [state.threads, state.classifications]
  );

  const getUnclassifiedThreads = useCallback((): GmailThread[] => {
    return state.threads.filter((t) => {
      const classification = state.classifications.get(t.id);
      return !classification || classification.bucketId === "unclassified";
    });
  }, [state.threads, state.classifications]);

  return {
    ...state,
    fetchThreads,
    classifyAll,
    addBucket,
    removeBucket,
    editBucket,
    reorderBuckets,
    restoreFromCache,
    moveThread,
    getThreadsByBucket,
    getUnclassifiedThreads,
  };
}
