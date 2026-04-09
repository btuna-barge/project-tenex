"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { GmailThread, Classification } from "@/types";
import { ClassificationBadge } from "./classification-badge";

interface DraggableThreadCardProps {
  thread: GmailThread;
  classification?: Classification;
  bucketId: string;
}

function parseSender(from: string): string {
  const match = from.match(/^(.+?)\s*</);
  return match ? match[1].replace(/"/g, "") : from;
}

export function DraggableThreadCard({
  thread,
  classification,
  bucketId,
}: DraggableThreadCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: thread.id,
    data: { bucketId },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`rounded-md border bg-background p-2.5 cursor-grab active:cursor-grabbing transition-shadow ${
        isDragging ? "shadow-lg opacity-75 z-50" : "shadow-sm hover:shadow-md"
      }`}
    >
      <div className="flex items-center justify-between gap-1 mb-1">
        <span className="text-xs font-medium text-muted-foreground truncate">
          {parseSender(thread.from)}
        </span>
        {classification && (
          <ClassificationBadge confidence={classification.confidence} />
        )}
      </div>
      <div className="text-sm font-medium truncate">{thread.subject}</div>
      <div className="text-xs text-muted-foreground truncate mt-0.5">
        {thread.snippet}
      </div>
    </div>
  );
}
