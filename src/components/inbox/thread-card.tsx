"use client";

import type { GmailThread, Classification } from "@/types";
import { ClassificationBadge } from "./classification-badge";

interface ThreadCardProps {
  thread: GmailThread;
  classification?: Classification;
  bucketLabel?: string;
  compact?: boolean;
}

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const now = new Date();

    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    } else if (date.getFullYear() === now.getFullYear()) {
      return date.toLocaleDateString([], { month: "short", day: "numeric" });
    } else {
      return date.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
    }
  } catch {
    return "";
  }
}

function parseSender(from: string): { name: string; email: string } {
  const match = from.match(/^(.+?)\s*<(.+?)>$/);
  if (match) return { name: match[1].replace(/"/g, ""), email: match[2] };
  return { name: from, email: from };
}

export function ThreadCard({
  thread,
  classification,
  bucketLabel,
  compact = false,
}: ThreadCardProps) {
  const sender = parseSender(thread.from);

  return (
    <div className="flex items-start gap-3 px-4 py-3 hover:bg-muted/50 transition-colors border-b border-border/50 cursor-default">
      {/* Sender avatar */}
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary">
        {sender.name?.charAt(0)?.toUpperCase() || "?"}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="font-semibold text-sm truncate">{sender.name}</span>
          {thread.messageCount > 1 && (
            <span className="text-xs text-muted-foreground">
              ({thread.messageCount})
            </span>
          )}
          <span className="ml-auto text-xs text-muted-foreground flex-shrink-0" suppressHydrationWarning>
            {formatDate(thread.date)}
          </span>
        </div>
        <div className="text-sm font-medium truncate">{thread.subject}</div>
        {!compact && (
          <div className="text-xs text-muted-foreground truncate mt-0.5">
            {thread.snippet}
          </div>
        )}
      </div>

      {/* Classification badge */}
      {classification && classification.bucketId !== "unclassified" && (
        <div className="flex-shrink-0 mt-1">
          <ClassificationBadge
            confidence={classification.confidence}
            bucketLabel={compact ? undefined : bucketLabel}
          />
        </div>
      )}
    </div>
  );
}
