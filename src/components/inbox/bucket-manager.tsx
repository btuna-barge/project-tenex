"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { Bucket } from "@/types";

const COLORS = [
  "#ef4444", "#f59e0b", "#22c55e", "#06b6d4",
  "#3b82f6", "#8b5cf6", "#ec4899", "#6b7280",
];

interface BucketManagerProps {
  onAddBucket: (bucket: Bucket) => void;
}

export function BucketManager({ onAddBucket }: BucketManagerProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(COLORS[4]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !description.trim()) return;

    const id = name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    if (!id) return;

    onAddBucket({
      id,
      label: name.trim(),
      description: description.trim(),
      color,
      isCustom: true,
    });

    setName("");
    setDescription("");
    setColor(COLORS[4]);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm" className="gap-1.5" />
        }
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 4v16m8-8H4"
          />
        </svg>
        Add Bucket
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Custom Bucket</DialogTitle>
        </DialogHeader>
        <BucketForm
          onSubmit={handleSubmit}
          name={name}
          setName={setName}
          description={description}
          setDescription={setDescription}
          color={color}
          setColor={setColor}
          submitLabel="Create Bucket & Reclassify"
        />
      </DialogContent>
    </Dialog>
  );
}

// --- Edit dialog (used inline in column headers / sidebar) ---

interface BucketEditDialogProps {
  bucket: Bucket;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (bucketId: string, updates: { label: string; description: string; color: string }) => void;
}

export function BucketEditDialog({ bucket, open, onOpenChange, onSave }: BucketEditDialogProps) {
  const [name, setName] = useState(bucket.label);
  const [description, setDescription] = useState(bucket.description);
  const [color, setColor] = useState(bucket.color);

  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => {
      setName(bucket.label);
      setDescription(bucket.description);
      setColor(bucket.color);
    });
    return () => cancelAnimationFrame(id);
  }, [open, bucket.label, bucket.description, bucket.color]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !description.trim()) return;
    onSave(bucket.id, {
      label: name.trim(),
      description: description.trim(),
      color,
    });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Bucket</DialogTitle>
        </DialogHeader>
        <BucketForm
          onSubmit={handleSubmit}
          name={name}
          setName={setName}
          description={description}
          setDescription={setDescription}
          color={color}
          setColor={setColor}
          submitLabel="Save & Reclassify"
        />
      </DialogContent>
    </Dialog>
  );
}

// --- Shared form ---

function BucketForm({
  onSubmit,
  name,
  setName,
  description,
  setDescription,
  color,
  setColor,
  submitLabel,
}: {
  onSubmit: (e: React.FormEvent) => void;
  name: string;
  setName: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  color: string;
  setColor: (v: string) => void;
  submitLabel: string;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="text-sm font-medium mb-1 block">Name</label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Job Applications"
          required
        />
      </div>
      <div>
        <label className="text-sm font-medium mb-1 block">Description</label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe what emails belong in this bucket. The AI uses this to classify."
          required
          rows={3}
        />
        <p className="text-xs text-muted-foreground mt-1">
          Be specific: the LLM reads this description to decide which emails go here.
        </p>
      </div>
      <div>
        <label className="text-sm font-medium mb-1 block">Color</label>
        <div className="flex gap-2">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              aria-label={`Select color ${c}`}
              className={`w-7 h-7 rounded-full transition-transform ${
                color === c ? "ring-2 ring-offset-2 ring-primary scale-110" : ""
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>
      <Button type="submit" className="w-full" disabled={!name.trim() || !description.trim()}>
        {submitLabel}
      </Button>
    </form>
  );
}
