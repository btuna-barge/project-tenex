"use client";

import { useState, useCallback, useMemo } from "react";
import type { FeedbackEvent } from "@/types";
import { createFeedbackEvent, computeAccuracy } from "@/lib/feedback";

export function useFeedback(totalClassified: number) {
  const [feedbackLog, setFeedbackLog] = useState<FeedbackEvent[]>([]);

  const logCorrection = useCallback(
    (
      threadId: string,
      predictedBucket: string,
      correctedBucket: string,
      confidence: number
    ) => {
      const event = createFeedbackEvent(
        threadId,
        predictedBucket,
        correctedBucket,
        confidence
      );
      setFeedbackLog((prev) => [...prev, event]);
    },
    []
  );

  const accuracy = useMemo(() => {
    // Count unique threads that were corrected
    const correctedThreads = new Set(feedbackLog.map((e) => e.threadId));
    return computeAccuracy(totalClassified, correctedThreads.size);
  }, [feedbackLog, totalClassified]);

  return { feedbackLog, logCorrection, accuracy };
}
