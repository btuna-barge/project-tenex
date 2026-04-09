import type { FeedbackEvent } from "@/types";

export function createFeedbackEvent(
  threadId: string,
  predictedBucket: string,
  correctedBucket: string,
  confidence: number
): FeedbackEvent {
  return {
    threadId,
    predictedBucket,
    correctedBucket,
    confidence,
    timestamp: new Date().toISOString(),
  };
}

export function computeAccuracy(
  totalClassified: number,
  corrections: number
): { rate: number; accepted: number; total: number } {
  const accepted = totalClassified - corrections;
  return {
    rate: totalClassified > 0 ? accepted / totalClassified : 1,
    accepted,
    total: totalClassified,
  };
}
