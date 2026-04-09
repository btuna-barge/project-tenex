"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { GmailThread, Bucket, Classification } from "@/types";
import { BucketColumn } from "./bucket-column";

interface SortableBucketColumnProps {
  bucket: Bucket;
  threads: GmailThread[];
  classifications: Map<string, Classification>;
  disableColumnDrag?: boolean;
  onRemove?: (bucketId: string) => void;
  onEdit?: (bucketId: string, updates: { label: string; description: string; color: string }) => void;
}

export function SortableBucketColumn({
  bucket,
  threads,
  classifications,
  disableColumnDrag,
  onRemove,
  onEdit,
}: SortableBucketColumnProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: bucket.id,
    data: { type: "column" },
    disabled: disableColumnDrag,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={isDragging ? "opacity-50 z-50" : ""}
    >
      <BucketColumn
        bucket={bucket}
        threads={threads}
        classifications={classifications}
        onRemove={onRemove}
        onEdit={onEdit}
        dragHandle={
          !disableColumnDrag ? (
            <div
              {...attributes}
              {...listeners}
              className="flex items-center justify-center cursor-grab active:cursor-grabbing opacity-40 hover:opacity-70 transition-opacity"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
                <circle cx="5" cy="4" r="1.5" />
                <circle cx="11" cy="4" r="1.5" />
                <circle cx="5" cy="8" r="1.5" />
                <circle cx="11" cy="8" r="1.5" />
                <circle cx="5" cy="12" r="1.5" />
                <circle cx="11" cy="12" r="1.5" />
              </svg>
            </div>
          ) : undefined
        }
      />
    </div>
  );
}
