"use client";

import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  rectSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { useState, useSyncExternalStore } from "react";
import type { GmailThread, Bucket, Classification } from "@/types";
import { SortableBucketColumn } from "./sortable-bucket-column";

interface BucketBoardProps {
  buckets: Bucket[];
  threads: GmailThread[];
  classifications: Map<string, Classification>;
  getThreadsByBucket: (bucketId: string) => GmailThread[];
  getUnclassifiedThreads: () => GmailThread[];
  onMoveThread: (
    threadId: string,
    fromBucket: string,
    toBucket: string,
    confidence: number
  ) => void;
  onReorderBuckets?: (buckets: Bucket[]) => void;
  onRemoveBucket?: (bucketId: string) => void;
  onEditBucket?: (bucketId: string, updates: { label: string; description: string; color: string }) => void;
}

export function BucketBoard({
  buckets,
  threads,
  classifications,
  getThreadsByBucket,
  getUnclassifiedThreads,
  onMoveThread,
  onReorderBuckets,
  onRemoveBucket,
  onEditBucket,
}: BucketBoardProps) {
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  const [activeId, setActiveId] = useState<string | null>(null);
  const [dragType, setDragType] = useState<"thread" | "column" | null>(null);
  const [overBucketId, setOverBucketId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  function handleDragStart(event: DragStartEvent) {
    const id = event.active.id as string;
    const data = event.active.data.current as { type?: string; bucketId?: string } | undefined;

    if (data?.type === "column") {
      setDragType("column");
      setActiveId(id);
    } else {
      setDragType("thread");
      setActiveId(id);
    }
  }

  function handleDragOver(event: DragOverEvent) {
    if (dragType !== "thread") return;

    const { over } = event;
    if (!over) {
      setOverBucketId(null);
      return;
    }

    const overData = over.data.current as { type?: string; bucketId?: string } | undefined;

    // Dropping onto a column drop zone
    if (overData?.type === "column" && overData?.bucketId) {
      setOverBucketId(overData.bucketId);
    } else if (overData?.bucketId) {
      // Dropping onto a thread card - use its bucket
      setOverBucketId(overData.bucketId);
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (dragType === "column" && over && onReorderBuckets) {
      // over.id might be "bucket-id" (sortable) or "bucket-id-drop" (droppable)
      const overData = over.data.current as { type?: string; bucketId?: string } | undefined;
      const targetId = overData?.bucketId ?? (over.id as string);

      if (active.id !== targetId) {
        const oldIndex = buckets.findIndex((b) => b.id === active.id);
        const newIndex = buckets.findIndex((b) => b.id === targetId);
        if (oldIndex !== -1 && newIndex !== -1) {
          onReorderBuckets(arrayMove(buckets, oldIndex, newIndex));
        }
      }
    }

    if (dragType === "thread") {
      const threadId = active.id as string;
      const fromBucket = (active.data.current as { bucketId: string })?.bucketId;
      const toBucket = overBucketId;

      if (fromBucket && toBucket && fromBucket !== toBucket) {
        const classification = classifications.get(threadId);
        const confidence = classification?.confidence ?? 0;
        onMoveThread(threadId, fromBucket, toBucket, confidence);
      }
    }

    setActiveId(null);
    setDragType(null);
    setOverBucketId(null);
  }

  const activeThread =
    dragType === "thread" && activeId
      ? threads.find((t) => t.id === activeId)
      : null;

  const activeBucket =
    dragType === "column" && activeId
      ? buckets.find((b) => b.id === activeId)
      : null;

  const unclassified = getUnclassifiedThreads();

  if (!mounted) {
    return (
      <div className="flex w-full min-w-0 flex-wrap content-start gap-4 px-4 pb-4 pt-4">
        {buckets.map((bucket) => (
          <div key={bucket.id} className="flex flex-col w-72 flex-shrink-0 rounded-lg border border-border bg-muted/30">
            <div className="px-3 py-2 border-b border-border flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: bucket.color }} />
              <span className="font-semibold text-sm">{bucket.label}</span>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={buckets.map((b) => b.id)} strategy={rectSortingStrategy}>
        <div className="flex w-full min-w-0 flex-wrap content-start gap-4 px-4 pb-4 pt-4">
          {buckets.map((bucket) => (
            <SortableBucketColumn
              key={bucket.id}
              bucket={bucket}
              threads={getThreadsByBucket(bucket.id)}
              classifications={classifications}
              onRemove={onRemoveBucket}
              onEdit={onEditBucket}
            />
          ))}
          {unclassified.length > 0 && (
            <SortableBucketColumn
              bucket={{
                id: "unclassified",
                label: "Unclassified",
                description: "Threads that could not be classified",
                color: "#9ca3af",
              }}
              threads={unclassified}
              classifications={classifications}
              disableColumnDrag
            />
          )}
        </div>
      </SortableContext>

      <DragOverlay>
        {activeThread && (
          <div className="rounded-md border border-border bg-card p-2.5 shadow-xl w-72 opacity-90">
            <div className="text-sm font-medium truncate">
              {activeThread.subject}
            </div>
            <div className="text-xs text-muted-foreground truncate mt-0.5">
              {activeThread.snippet}
            </div>
          </div>
        )}
        {activeBucket && (
          <div className="w-72 rounded-lg border border-primary bg-card shadow-xl opacity-90 p-3">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: activeBucket.color }} />
              <span className="font-semibold text-sm">{activeBucket.label}</span>
            </div>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
