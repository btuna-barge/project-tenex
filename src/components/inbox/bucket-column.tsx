"use client";

import { useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import type { GmailThread, Bucket, Classification } from "@/types";
import { Badge } from "@/components/ui/badge";
import { DraggableThreadCard } from "./draggable-thread-card";
import { BucketEditDialog } from "./bucket-manager";

interface BucketColumnProps {
  bucket: Bucket;
  threads: GmailThread[];
  classifications: Map<string, Classification>;
  dragHandle?: React.ReactNode;
  onRemove?: (bucketId: string) => void;
  onEdit?: (bucketId: string, updates: { label: string; description: string; color: string }) => void;
}

export function BucketColumn({
  bucket,
  threads,
  classifications,
  dragHandle,
  onRemove,
  onEdit,
}: BucketColumnProps) {
  const [editOpen, setEditOpen] = useState(false);
  const { setNodeRef, isOver } = useDroppable({ id: `${bucket.id}-drop`, data: { type: "column", bucketId: bucket.id } });

  return (
    <div
      ref={setNodeRef}
      className={`group/col flex flex-col w-72 flex-shrink-0 rounded-lg border bg-muted/30 transition-colors ${
        isOver ? "border-primary bg-primary/5" : "border-border"
      }`}
    >
      {/* Column header */}
      <div className="px-3 py-2 border-b border-border flex items-center gap-2">
        {dragHandle}
        <div
          className="w-3 h-3 rounded-full flex-shrink-0"
          style={{ backgroundColor: bucket.color }}
        />
        <span className="font-semibold text-sm truncate">{bucket.label}</span>
        <div className="ml-auto flex items-center gap-1">
          {onEdit && (
            <button
              onClick={() => setEditOpen(true)}
              aria-label={`Edit ${bucket.label}`}
              className="opacity-0 group-hover/col:opacity-100 transition-opacity text-muted-foreground hover:text-foreground p-0.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
          )}
          {bucket.isCustom && onRemove && (
            <button
              onClick={() => onRemove(bucket.id)}
              aria-label={`Delete ${bucket.label}`}
              className="opacity-0 group-hover/col:opacity-100 transition-opacity text-muted-foreground hover:text-destructive p-0.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
          <Badge variant="secondary" className="text-xs">
            {threads.length}
          </Badge>
        </div>
      </div>

      {/* Thread cards */}
      <SortableContext
        items={threads.map((t) => t.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex-1 overflow-y-auto p-2 space-y-1.5 max-h-[calc(100vh-12rem)]">
          {threads.map((thread) => (
            <DraggableThreadCard
              key={thread.id}
              thread={thread}
              classification={classifications.get(thread.id)}
              bucketId={bucket.id}
            />
          ))}
          {threads.length === 0 && (
            <div className="text-center text-xs text-muted-foreground py-8">
              Drop threads here
            </div>
          )}
        </div>
      </SortableContext>

      {/* Edit dialog */}
      {onEdit && (
        <BucketEditDialog
          bucket={bucket}
          open={editOpen}
          onOpenChange={setEditOpen}
          onSave={onEdit}
        />
      )}
    </div>
  );
}
