"use client";

import { useState, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { fixMarkdownTables } from "./fix-markdown-tables";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Copy, Download, Sparkles } from "lucide-react";
import { toast } from "sonner";

interface Props {
  dossier: string;
  companyName: string;
  trigger?: React.ReactNode;
}

export function DossierViewer({ dossier, companyName, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const normalized = useMemo(() => fixMarkdownTables(dossier), [dossier]);

  async function copy() {
    await navigator.clipboard.writeText(dossier);
    toast.success("Dossier copied to clipboard");
  }

  function download() {
    const slug = companyName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    const blob = new Blob([dossier], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slug}-research-dossier.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Dossier downloaded");
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-2">
            <FileText className="h-3.5 w-3.5" />
            View Research Dossier
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="!max-w-[min(1100px,92vw)] sm:!max-w-[min(1100px,92vw)] max-h-[92vh] flex flex-col p-0 overflow-hidden gap-0">
        <DialogHeader className="px-6 pt-5 pb-3 border-b border-zinc-100">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1.5 flex-1 min-w-0">
              <DialogTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-4 w-4 text-purple-500 shrink-0" />
                Research Dossier
                <Badge className="bg-zinc-100 text-zinc-600 font-normal">
                  {(dossier.length / 1000).toFixed(1)}K chars
                </Badge>
              </DialogTitle>
              <p className="text-xs text-zinc-500">
                Comprehensive intelligence on{" "}
                <span className="font-medium text-zinc-700">{companyName}</span>{" "}
                — internal research artifact for fact-checking.
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button variant="ghost" size="sm" onClick={copy} className="gap-1">
                <Copy className="h-3.5 w-3.5" />
                Copy
              </Button>
              <Button variant="ghost" size="sm" onClick={download} className="gap-1">
                <Download className="h-3.5 w-3.5" />
                .md
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-10 py-7">
          <article className="dossier-content max-w-[860px] mx-auto">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{normalized}</ReactMarkdown>
          </article>
        </div>
      </DialogContent>
    </Dialog>
  );
}
