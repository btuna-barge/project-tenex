"use client";

import { useState } from "react";
import type { GmailThread, Bucket, Classification } from "@/types";
import { ThreadCard } from "./thread-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BucketEditDialog } from "./bucket-manager";

interface ThreadListProps {
  threads: GmailThread[];
  buckets: Bucket[];
  classifications: Map<string, Classification>;
  getThreadsByBucket: (bucketId: string) => GmailThread[];
  getUnclassifiedThreads: () => GmailThread[];
  onRemoveBucket?: (bucketId: string) => void;
  onEditBucket?: (bucketId: string, updates: { label: string; description: string; color: string }) => void;
}

function BucketSection({
  bucket,
  threads,
  classifications,
  onRemove,
  onEdit,
}: {
  bucket: Bucket;
  threads: GmailThread[];
  classifications: Map<string, Classification>;
  onRemove?: (bucketId: string) => void;
  onEdit?: (bucketId: string, updates: { label: string; description: string; color: string }) => void;
}) {
  const [editOpen, setEditOpen] = useState(false);

  return (
    <div>
      <div className="sticky top-0 bg-background/95 backdrop-blur-sm z-10 px-6 py-2.5 border-b border-border flex items-center gap-2">
        <div
          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: bucket.color }}
        />
        <span className="font-semibold text-sm">{bucket.label}</span>
        <span className="text-xs text-muted-foreground">
          {threads.length}
        </span>
        {bucket.isCustom && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
            Custom
          </Badge>
        )}
        {onEdit && (
          <Button
            variant="ghost"
            size="sm"
            className="h-5 w-5 p-0 ml-1 text-muted-foreground hover:text-foreground"
            onClick={() => setEditOpen(true)}
            aria-label={`Edit ${bucket.label}`}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </Button>
        )}
        {bucket.isCustom && onRemove && (
          <Button
            variant="ghost"
            size="sm"
            className="h-5 w-5 p-0 ml-1 text-muted-foreground hover:text-destructive"
            onClick={() => onRemove(bucket.id)}
            aria-label={`Delete ${bucket.label}`}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </Button>
        )}
      </div>
      {threads.map((thread) => (
        <ThreadCard
          key={thread.id}
          thread={thread}
          classification={classifications.get(thread.id)}
          bucketLabel={bucket.label}
        />
      ))}
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

export function ThreadList({
  buckets,
  classifications,
  getThreadsByBucket,
  getUnclassifiedThreads,
  onRemoveBucket,
  onEditBucket,
}: ThreadListProps) {
  const unclassified = getUnclassifiedThreads();

  return (
    <div>
      {buckets.map((bucket) => {
        const bucketThreads = getThreadsByBucket(bucket.id);
        if (bucketThreads.length === 0) return null;

        return (
          <BucketSection
            key={bucket.id}
            bucket={bucket}
            threads={bucketThreads}
            classifications={classifications}
            onRemove={onRemoveBucket}
            onEdit={onEditBucket}
          />
        );
      })}

      {/* Empty state */}
      {buckets.every((b) => getThreadsByBucket(b.id).length === 0) && unclassified.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <svg className="w-10 h-10 mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
          <p className="text-sm">No emails to show</p>
        </div>
      )}

      {/* Unclassified threads */}
      {unclassified.length > 0 && (
        <div>
          <div className="sticky top-0 bg-background/95 backdrop-blur-sm z-10 px-6 py-2.5 border-b border-border flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-gray-400 flex-shrink-0" />
            <span className="font-semibold text-sm">Unclassified</span>
            <span className="text-xs text-muted-foreground">
              {unclassified.length}
            </span>
          </div>
          {unclassified.map((thread) => (
            <ThreadCard
              key={thread.id}
              thread={thread}
              classification={classifications.get(thread.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
