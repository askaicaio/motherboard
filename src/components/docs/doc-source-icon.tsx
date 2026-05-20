// Per-source icon for doc cards. Uses Lucide icons with brand-ish colors
// rather than pulling brand logos (avoids licensing + works offline).
import {
  FileText,
  Sheet,
  Presentation,
  HardDrive,
  Hash,
  MessageSquare,
  Video,
  Frame,
  Code2,
  FileType,
  Link2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { DocSource } from "@/lib/documents/source";

const REGISTRY: Record<
  DocSource,
  { icon: React.ElementType; tone: string }
> = {
  google_docs:    { icon: FileText,     tone: "bg-blue-50 text-blue-600" },
  google_sheets:  { icon: Sheet,        tone: "bg-emerald-50 text-emerald-600" },
  google_slides:  { icon: Presentation, tone: "bg-amber-50 text-amber-600" },
  google_drive:   { icon: HardDrive,    tone: "bg-zinc-100 text-zinc-700" },
  notion:         { icon: Hash,         tone: "bg-zinc-100 text-zinc-900" },
  slack:          { icon: MessageSquare, tone: "bg-purple-50 text-purple-600" },
  loom:           { icon: Video,        tone: "bg-violet-50 text-violet-600" },
  figma:          { icon: Frame,        tone: "bg-pink-50 text-pink-600" },
  github:         { icon: Code2,        tone: "bg-zinc-900 text-white" },
  pdf:            { icon: FileType,     tone: "bg-red-50 text-red-600" },
  web:            { icon: Link2,        tone: "bg-zinc-100 text-zinc-600" },
};

export function DocSourceIcon({
  source,
  className,
}: {
  source: DocSource;
  className?: string;
}) {
  const def = REGISTRY[source] || REGISTRY.web;
  const Icon = def.icon;
  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-md",
        def.tone,
        className,
      )}
    >
      <Icon className="h-4 w-4" />
    </div>
  );
}
