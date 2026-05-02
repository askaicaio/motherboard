"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Upload, FileUp, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  reportId: string;
  /** Disable upload button if research is currently running */
  disabled?: boolean;
  trigger?: React.ReactNode;
}

export function DossierUploadDialog({ reportId, disabled, trigger }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 200_000) {
      toast.error("File too large (max 200KB)");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setContent(typeof reader.result === "string" ? reader.result : "");
      toast.success(`Loaded ${file.name} (${(file.size / 1024).toFixed(1)}KB)`);
    };
    reader.onerror = () => toast.error("Failed to read file");
    reader.readAsText(file);
  }

  async function handleSubmit(runDistillation: boolean) {
    if (content.trim().length < 500) {
      toast.error("Dossier must be at least 500 characters");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/reports/${reportId}/dossier`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: content.trim(), runDistillation }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      toast.success(data.message || "Dossier uploaded");
      setOpen(false);
      setContent("");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-1.5" disabled={disabled}>
            <Upload className="h-3.5 w-3.5" />
            Upload Dossier
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="!max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <FileUp className="h-4 w-4 text-purple-500" />
            Upload Research Dossier
          </DialogTitle>
          <DialogDescription>
            Skip Stage 1 by providing your own pre-written dossier. Useful if
            you ran research with your own Claude Pro account, or have an
            existing dossier from a previous engagement.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="dossier-content">Markdown content</Label>
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".md,.txt,text/markdown,text/plain"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-xs h-7 gap-1"
                >
                  <Upload className="h-3 w-3" />
                  Load .md file
                </Button>
              </div>
            </div>
            <Textarea
              id="dossier-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="# Acme Corp: Strategic AI Profile&#10;&#10;**TL;DR thesis paragraph...**&#10;&#10;## Section 1: Company overview&#10;..."
              rows={14}
              className="font-mono text-xs"
            />
            <div className="flex items-center justify-between text-xs text-zinc-500">
              <span>
                {content.length.toLocaleString()} / 200,000 chars
              </span>
              {content.length > 0 && content.length < 500 && (
                <span className="text-amber-600">Min 500 chars</span>
              )}
              {content.length >= 500 && (
                <span className="text-emerald-600">
                  ~{Math.round(content.length / 1000)}K chars — looks good
                </span>
              )}
            </div>
          </div>

          <div className="rounded-md bg-zinc-50 border border-zinc-200 p-3 text-xs text-zinc-600 space-y-1">
            <p className="font-medium text-zinc-900">What happens next:</p>
            <ul className="list-disc pl-4 space-y-0.5">
              <li>The dossier is saved as the report&apos;s research output</li>
              <li>
                <strong>Save & generate slides:</strong> immediately runs Stage 2
                (slide distillation) — ~$0.30, ~1-2 min, produces the 10-slide markdown ready for Gamma
              </li>
              <li>
                <strong>Save only:</strong> just store the dossier — useful if
                you want to review before generating slides
              </li>
            </ul>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleSubmit(false)}
              disabled={submitting || content.trim().length < 500}
            >
              Save only
            </Button>
            <Button
              type="button"
              onClick={() => handleSubmit(true)}
              disabled={submitting || content.trim().length < 500}
              className="gap-1.5"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <FileUp className="h-3.5 w-3.5" />
                  Save & generate slides
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
