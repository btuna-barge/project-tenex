"use client";

import { Badge } from "@/components/ui/badge";

interface ClassificationBadgeProps {
  confidence: number;
  bucketLabel?: string;
}

export function ClassificationBadge({
  confidence,
  bucketLabel,
}: ClassificationBadgeProps) {
  const pct = Math.round(confidence * 100);

  const variant: "default" | "secondary" | "destructive" | "outline" = "default";
  let colorClass = "";

  if (confidence >= 0.85) {
    colorClass = "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/50 dark:text-green-300 dark:border-green-800";
  } else if (confidence >= 0.6) {
    colorClass = "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/50 dark:text-yellow-300 dark:border-yellow-800";
  } else {
    colorClass = "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/50 dark:text-red-300 dark:border-red-800";
  }

  return (
    <Badge variant={variant} className={`text-xs font-medium ${colorClass}`}>
      {bucketLabel && `${bucketLabel} · `}{pct}%
    </Badge>
  );
}
