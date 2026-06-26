"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import {
  FolderOpen,
  Plus,
  Upload,
  Link2,
  Trash2,
  ExternalLink,
  FileText,
  Loader2,
  Eye,
  EyeOff,
} from "lucide-react";
import { toast } from "sonner";

export interface ResourceItem {
  id: string;
  title: string;
  description: string | null;
  category: string;
  fileUrl: string | null;
  externalUrl: string | null;
  fileName: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  isPublic: boolean;
  createdAt: string;
}

const CATEGORIES = [
  { value: "playbook", label: "Playbook" },
  { value: "toolkit", label: "Marketing Toolkit" },
  { value: "brand_asset", label: "Brand Asset" },
  { value: "email_template", label: "Email Template" },
  { value: "social_post", label: "Social Post" },
  { value: "banner", label: "Banner" },
  { value: "other", label: "Other" },
];

function categoryLabel(v: string) {
  return CATEGORIES.find((c) => c.value === v)?.label ?? v;
}

function fmtSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ResourcesAdminClient({
  initialResources,
}: {
  initialResources: ResourceItem[];
}) {
  const router = useRouter();
  const [resources, setResources] = useState(initialResources);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);

  const handleCreated = (r: ResourceItem) => {
    setResources((prev) => [r, ...prev]);
  };

  const handleDelete = async (r: ResourceItem) => {
    if (!confirm(`Remove "${r.title}"?`)) return;
    const res = await fetch(`/api/partners/resources/${r.id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      toast.error("Failed to remove");
      return;
    }
    setResources((prev) => prev.filter((x) => x.id !== r.id));
    toast.success("Removed");
    router.refresh();
  };

  const togglePublic = async (r: ResourceItem) => {
    const res = await fetch(`/api/partners/resources/${r.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPublic: !r.isPublic }),
    });
    if (!res.ok) {
      toast.error("Failed to update");
      return;
    }
    setResources((prev) =>
      prev.map((x) => (x.id === r.id ? { ...x, isPublic: !r.isPublic } : x)),
    );
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5 text-zinc-500" />
            <h1 className="text-2xl font-semibold tracking-tight">
              Marketing Resources
            </h1>
          </div>
          <p className="mt-1 max-w-2xl text-sm text-zinc-500">
            Upload the Affiliate Playbook, Marketing Toolkit, brand assets, email
            templates, and banners. Public ones appear on the affiliate
            resources page at <span className="font-mono">/partners/resources</span>.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setLinkOpen(true)}>
            <Link2 className="mr-2 h-4 w-4" />
            Add link
          </Button>
          <Button onClick={() => setUploadOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Upload file
          </Button>
        </div>
      </div>

      {resources.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="rounded-full bg-zinc-100 p-3">
              <FolderOpen className="h-6 w-6 text-zinc-500" />
            </div>
            <div>
              <h3 className="font-medium">No resources yet</h3>
              <p className="mt-1 text-sm text-zinc-500">
                Upload the Playbook and Marketing Toolkit, or link existing
                assets, to make them available to affiliates.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {resources.map((r) => {
            const url = r.fileUrl || r.externalUrl || "#";
            return (
              <Card key={r.id} className="group">
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {r.fileUrl ? (
                        <FileText className="h-4 w-4 shrink-0 text-zinc-500" />
                      ) : (
                        <Link2 className="h-4 w-4 shrink-0 text-zinc-500" />
                      )}
                      <span className="truncate font-medium">{r.title}</span>
                    </div>
                    <Badge variant="secondary" className="shrink-0 text-[10px]">
                      {categoryLabel(r.category)}
                    </Badge>
                  </div>
                  {r.description && (
                    <p className="line-clamp-2 text-sm text-zinc-600">
                      {r.description}
                    </p>
                  )}
                  <div className="flex items-center justify-between border-t pt-2 text-xs text-zinc-500">
                    <a
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 hover:text-zinc-900"
                    >
                      <ExternalLink className="h-3 w-3" />
                      {r.fileName || "Open"}
                      {r.sizeBytes ? ` · ${fmtSize(r.sizeBytes)}` : ""}
                    </a>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => togglePublic(r)}
                        title={r.isPublic ? "Public — click to hide" : "Hidden — click to publish"}
                        className={r.isPublic ? "text-emerald-600" : "text-zinc-400"}
                      >
                        {r.isPublic ? (
                          <Eye className="h-3.5 w-3.5" />
                        ) : (
                          <EyeOff className="h-3.5 w-3.5" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(r)}
                        className="text-zinc-400 hover:text-red-600"
                        title="Remove"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <UploadDialog open={uploadOpen} onOpenChange={setUploadOpen} onCreated={handleCreated} />
      <LinkDialog open={linkOpen} onOpenChange={setLinkOpen} onCreated={handleCreated} />
    </div>
  );
}

function CategorySelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-zinc-400 focus:outline-none"
    >
      {CATEGORIES.map((c) => (
        <option key={c.value} value={c.value}>
          {c.label}
        </option>
      ))}
    </select>
  );
}

function UploadDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated: (r: ResourceItem) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("playbook");
  const [isPublic, setIsPublic] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      toast.error("Choose a file");
      return;
    }
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      fd.set("title", title.trim());
      fd.set("description", description.trim());
      fd.set("category", category);
      fd.set("isPublic", String(isPublic));
      const res = await fetch("/api/partners/resources", {
        method: "POST",
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "Upload failed");
        return;
      }
      onCreated(data.resource);
      toast.success("Uploaded");
      onOpenChange(false);
      setTitle("");
      setDescription("");
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      {/* Rendered OUTSIDE the Base UI Dialog portal so the modal's focus scope
          can't swallow the native file input's change event. */}
      <input
        ref={fileRef}
        type="file"
        accept="application/pdf,image/*,.doc,.docx,.ppt,.pptx"
        className="hidden"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
      />
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Upload a resource</DialogTitle>
          <DialogDescription>
            PDF, image, or document. Stored on Vercel Blob and downloadable by
            affiliates if public.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label>File</Label>
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => fileRef.current?.click()}
              >
                {file ? "Change file" : "Choose file"}
              </Button>
              <span className="truncate text-sm text-muted-foreground">
                {file
                  ? `${file.name} (${Math.round(file.size / 1024)} KB)`
                  : "No file chosen"}
              </span>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="res-title">Title</Label>
            <Input id="res-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Affiliate Playbook" />
          </div>
          <div className="space-y-1.5">
            <Label>Category</Label>
            <CategorySelect value={category} onChange={setCategory} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="res-desc">Description</Label>
            <Textarea id="res-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={isPublic} onCheckedChange={setIsPublic} />
            Visible to affiliates (public)
          </label>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              Upload
            </Button>
          </DialogFooter>
        </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function LinkDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated: (r: ResourceItem) => void;
}) {
  const [title, setTitle] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("toolkit");
  const [isPublic, setIsPublic] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !externalUrl.trim()) {
      toast.error("Title and URL are required");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/partners/resources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          externalUrl: externalUrl.trim(),
          description: description.trim() || null,
          category,
          isPublic,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "Failed to add link");
        return;
      }
      onCreated(data.resource);
      toast.success("Link added");
      onOpenChange(false);
      setTitle("");
      setExternalUrl("");
      setDescription("");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add a linked resource</DialogTitle>
          <DialogDescription>
            Point to an existing asset (Google Drive, Canva, Notion, etc.).
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="link-title">Title</Label>
            <Input id="link-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Marketing Toolkit" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="link-url">URL</Label>
            <Input id="link-url" type="url" value={externalUrl} onChange={(e) => setExternalUrl(e.target.value)} placeholder="https://…" />
          </div>
          <div className="space-y-1.5">
            <Label>Category</Label>
            <CategorySelect value={category} onChange={setCategory} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="link-desc">Description</Label>
            <Textarea id="link-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={isPublic} onCheckedChange={setIsPublic} />
            Visible to affiliates (public)
          </label>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add link
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
