"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

// Copy-to-clipboard button for ready-to-use toolkit copy blocks.
// Handles multiline values. Use `size="sm"` for compact rows and
// `variant="onDark"` on navy/indigo backgrounds.
export function CopyBlockButton({
  value,
  size = "md",
  variant = "default",
}: {
  value: string;
  size?: "sm" | "md";
  variant?: "default" | "onDark";
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard may be unavailable (e.g. insecure context) — fail silently.
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label="Copy to clipboard"
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-lg font-semibold transition",
        size === "sm" ? "px-2.5 py-1.5 text-xs" : "px-3.5 py-2 text-sm",
        variant === "onDark"
          ? "bg-white/10 text-white hover:bg-white/20"
          : "bg-[#4f46e5] text-white hover:bg-indigo-700",
      )}
    >
      {copied ? (
        <>
          <Check className={size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"} />
          Copied
        </>
      ) : (
        <>
          <Copy className={size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"} />
          Copy
        </>
      )}
    </button>
  );
}
