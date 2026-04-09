"use client";

import {
  DndContext,
  DragEndEvent,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useState, useSyncExternalStore } from "react";
import type { Bucket, Classification, GmailThread } from "@/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { BucketChart } from "./bucket-chart";
import { BucketEditDialog } from "./bucket-manager";

interface BucketSidebarProps {
  buckets: Bucket[];
  activeBucketFilter: string | null;
  onFilterChange: (bucketId: string | null) => void;
  onReorder: (buckets: Bucket[]) => void;
  onRemove: (bucketId: string) => void;
  onEdit: (bucketId: string, updates: { label: string; description: string; color: string }) => void;
  getCount: (bucketId: string) => number;
  getUnclassifiedThreads: () => GmailThread[];
  totalThreads: number;
  classifiedCount: number;
  avgConfidence: number;
  corrections: number;
  classifications: Map<string, Classification>;
  getThreadsByBucket: (bucketId: string) => GmailThread[];
}

function SortableBucketItem({
  bucket,
  count,
  isActive,
  onFilter,
  onRemove,
  onEdit,
}: {
  bucket: Bucket;
  count: number;
  isActive: boolean;
  onFilter: () => void;
  onRemove?: () => void;
  onEdit?: (bucketId: string, updates: { label: string; description: string; color: string }) => void;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: bucket.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group flex items-center h-8 rounded-md transition-colors text-sm ${
        isDragging ? "opacity-50 z-50" : ""
      } ${
        isActive
          ? "bg-primary/10 text-primary font-medium"
          : "text-foreground hover:bg-muted"
      }`}
    >
      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        className="flex items-center justify-center w-6 flex-shrink-0 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-40 transition-opacity"
      >
        <svg className="w-3 h-3" viewBox="0 0 16 16" fill="currentColor">
          <circle cx="5" cy="4" r="1.5" />
          <circle cx="11" cy="4" r="1.5" />
          <circle cx="5" cy="8" r="1.5" />
          <circle cx="11" cy="8" r="1.5" />
          <circle cx="5" cy="12" r="1.5" />
          <circle cx="11" cy="12" r="1.5" />
        </svg>
      </div>

      {/* Clickable area */}
      <button
        onClick={onFilter}
        className="flex items-center gap-2 flex-1 min-w-0 h-full"
      >
        <div
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ backgroundColor: bucket.color }}
        />
        <span className="truncate flex-1 text-left">{bucket.label}</span>
      </button>

      {/* Count - always in same position */}
      <span className="text-xs text-muted-foreground tabular-nums w-5 text-right flex-shrink-0">{count}</span>

      {/* Edit + Delete - reserve space so count stays aligned */}
      <div className="w-5 flex-shrink-0 flex items-center justify-center">
        {onEdit && (
          <button
            onClick={() => setEditOpen(true)}
            aria-label={`Edit ${bucket.label}`}
            className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </button>
        )}
      </div>
      <div className="w-5 flex-shrink-0 flex items-center justify-center">
        {bucket.isCustom && onRemove && (
          <button
            onClick={onRemove}
            aria-label={`Delete ${bucket.label}`}
            className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
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

export function BucketSidebar({
  buckets,
  activeBucketFilter,
  onFilterChange,
  onReorder,
  onRemove,
  onEdit,
  getCount,
  getUnclassifiedThreads,
  totalThreads,
  classifiedCount,
  avgConfidence,
  corrections,
  classifications,
  getThreadsByBucket,
}: BucketSidebarProps) {
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = buckets.findIndex((b) => b.id === active.id);
    const newIndex = buckets.findIndex((b) => b.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    onReorder(arrayMove(buckets, oldIndex, newIndex));
  }

  return (
    <aside className="w-52 border-r border-border bg-card p-3 flex-shrink-0 overflow-y-auto hidden md:flex md:flex-col">
      <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-2">
        Buckets
      </div>

      {/* All emails */}
      <button
        onClick={() => onFilterChange(null)}
        className={`flex items-center gap-2 h-8 px-2 rounded-md transition-colors text-left text-sm mb-0.5 ${
          activeBucketFilter === null
            ? "bg-primary/10 text-primary font-medium"
            : "text-foreground hover:bg-muted"
        }`}
      >
        <svg className="w-3.5 h-3.5 flex-shrink-0 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
        </svg>
        <span className="flex-1">All emails</span>
        <span className="text-xs text-muted-foreground tabular-nums w-5 text-right">{totalThreads}</span>
      </button>

      {/* Draggable bucket list - only render DndContext client-side to avoid hydration mismatch */}
      {mounted ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={buckets.map((b) => b.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-0.5">
              {buckets.map((bucket) => (
                <SortableBucketItem
                  key={bucket.id}
                  bucket={bucket}
                  count={getCount(bucket.id)}
                  isActive={activeBucketFilter === bucket.id}
                  onFilter={() =>
                    onFilterChange(activeBucketFilter === bucket.id ? null : bucket.id)
                  }
                  onRemove={bucket.isCustom ? () => onRemove(bucket.id) : undefined}
                  onEdit={onEdit}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        <div className="space-y-0.5">
          {buckets.map((bucket) => (
            <div key={bucket.id} className="flex items-center h-8 rounded-md text-sm text-foreground">
              <div className="w-6 flex-shrink-0" />
              <div className="flex items-center gap-2 flex-1 min-w-0 h-full">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: bucket.color }} />
                <span className="truncate flex-1 text-left">{bucket.label}</span>
              </div>
              <span className="text-xs text-muted-foreground tabular-nums w-5 text-right flex-shrink-0">{getCount(bucket.id)}</span>
              <div className="w-5 flex-shrink-0" />
              <div className="w-5 flex-shrink-0" />
            </div>
          ))}
        </div>
      )}

      {/* Unclassified - not a real bucket id in state; threads failed / invalid LLM bucket */}
      <button
        type="button"
        onClick={() =>
          onFilterChange(activeBucketFilter === "unclassified" ? null : "unclassified")
        }
        className={`flex items-center gap-2 h-8 px-2 rounded-md transition-colors text-left text-sm mt-1 ${
          activeBucketFilter === "unclassified"
            ? "bg-primary/10 text-primary font-medium"
            : "text-foreground hover:bg-muted"
        }`}
      >
        <div className="w-3.5 h-3.5 flex-shrink-0 rounded-sm bg-muted-foreground/40" aria-hidden />
        <span className="flex-1 truncate">Unclassified</span>
        <span className="text-xs text-muted-foreground tabular-nums w-5 text-right">
          {getUnclassifiedThreads().length}
        </span>
      </button>

      {/* Stats */}
      {classifiedCount > 0 && (
        <div className="mt-auto pt-4 border-t border-border">
          <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-2">
            Stats
          </div>
          <table className="w-full text-xs px-2">
            <tbody>
              {[
                ["Total", totalThreads],
                ["Classified", classifiedCount],
                ["Confidence", `${Math.round(avgConfidence * 100)}%`],
                ["Corrections", corrections],
              ].map(([label, value]) => (
                <tr key={String(label)}>
                  <td className="text-muted-foreground py-0.5 pl-2">{label}</td>
                  <td className="font-medium text-foreground tabular-nums text-right py-0.5 pr-2">{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Dialog>
            <DialogTrigger
              render={
                <button className="mt-3 w-full text-xs text-primary hover:text-primary/80 transition-colors flex items-center justify-center gap-1.5 py-1.5 rounded-md hover:bg-muted" />
              }
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              View Charts
            </DialogTrigger>
            <DialogContent className="max-w-2xl w-full">
              <DialogHeader>
                <DialogTitle>Classification Overview</DialogTitle>
              </DialogHeader>
              <BucketChart
                buckets={buckets}
                classifications={classifications}
                getThreadsByBucket={getThreadsByBucket}
                getUnclassifiedThreads={getUnclassifiedThreads}
              />
            </DialogContent>
          </Dialog>
        </div>
      )}
    </aside>
  );
}
