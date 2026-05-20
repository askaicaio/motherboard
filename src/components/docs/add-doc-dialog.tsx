"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, X } from "lucide-react";
import { toast } from "sonner";
import type { DocItem } from "./docs-page-client";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existing?: DocItem;
  onCreated?: (doc: DocItem) => void;
  onUpdated?: (doc: DocItem) => void;
  knownCategories?: string[];
}

export function AddDocDialog({
  open,
  onOpenChange,
  existing,
  onCreated,
  onUpdated,
  knownCategories = [],
}: Props) {
  const isEdit = !!existing;
  const [submitting, setSubmitting] = useState(false);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);

  // Hydrate fields when opening for edit / reset when opening for create
  useEffect(() => {
    if (!open) return;
    if (existing) {
      setTitle(existing.title);
      setUrl(existing.url);
      setDescription(existing.description ?? "");
      setCategory(existing.category ?? "");
      setTags(existing.tags ?? []);
    } else {
      setTitle("");
      setUrl("");
      setDescription("");
      setCategory("");
      setTags([]);
    }
    setTagInput("");
  }, [open, existing]);

  function addTagFromInput() {
    const raw = tagInput.trim();
    if (!raw) return;
    // Split on commas to allow paste-multiple
    const candidates = raw
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t && !tags.includes(t));
    if (candidates.length === 0) {
      setTagInput("");
      return;
    }
    setTags([...tags, ...candidates]);
    setTagInput("");
  }

  function removeTag(t: string) {
    setTags(tags.filter((tag) => tag !== t));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !url.trim()) {
      toast.error("Title and URL are required");
      return;
    }
    setSubmitting(true);
    try {
      const body = {
        title: title.trim(),
        url: url.trim(),
        description: description.trim() || null,
        category: category.trim() || null,
        tags,
      };
      const endpoint = isEdit ? `/api/documents/${existing!.id}` : "/api/documents";
      const method = isEdit ? "PATCH" : "POST";
      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to save");
        return;
      }
      const doc: DocItem = {
        id: data.document.id,
        title: data.document.title,
        url: data.document.url,
        description: data.document.description,
        category: data.document.category,
        tags: data.document.tags || [],
        pinned: data.document.pinned ?? false,
        createdAt: data.document.createdAt,
        updatedAt: data.document.updatedAt,
      };
      if (isEdit) {
        onUpdated?.(doc);
      } else {
        onCreated?.(doc);
      }
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit doc" : "Add doc"}</DialogTitle>
          <DialogDescription>
            Paste a link to any external doc — Google Docs, Notion, Slack, etc.
            We&apos;ll auto-detect the source.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="doc-title">Title *</Label>
            <Input
              id="doc-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Booking Calls Guide"
              required
              maxLength={300}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="doc-url">URL *</Label>
            <Input
              id="doc-url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://docs.google.com/document/d/…"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="doc-category">Category</Label>
            <Input
              id="doc-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g. Sales, Onboarding, Operations"
              list="known-categories"
              maxLength={100}
            />
            {knownCategories.length > 0 && (
              <datalist id="known-categories">
                {knownCategories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            )}
            <p className="text-xs text-zinc-500">
              Used to group docs on the page. Existing values autocomplete.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="doc-tags">Tags</Label>
            <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-zinc-300 px-2 py-1.5 focus-within:border-zinc-400">
              {tags.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-xs"
                >
                  {t}
                  <button
                    type="button"
                    onClick={() => removeTag(t)}
                    className="text-zinc-400 hover:text-zinc-700"
                    aria-label={`Remove tag ${t}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              <input
                id="doc-tags"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault();
                    addTagFromInput();
                  } else if (e.key === "Backspace" && !tagInput && tags.length > 0) {
                    setTags(tags.slice(0, -1));
                  }
                }}
                onBlur={addTagFromInput}
                placeholder={tags.length === 0 ? "sales, calls, training" : ""}
                className="flex-1 min-w-[120px] bg-transparent text-sm outline-none"
              />
            </div>
            <p className="text-xs text-zinc-500">
              Press Enter or comma to add. Backspace clears the last tag.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="doc-description">Description</Label>
            <Textarea
              id="doc-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short blurb shown under the title — what's this doc for?"
              rows={2}
              maxLength={1000}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? "Save changes" : "Add doc"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
