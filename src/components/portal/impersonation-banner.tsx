"use client";

import { useState } from "react";
import { Eye, Loader2 } from "lucide-react";

/** Sticky banner shown while an admin is viewing the portal "as" an affiliate. */
export function ImpersonationBanner({ name }: { name: string }) {
  const [exiting, setExiting] = useState(false);

  async function exit() {
    setExiting(true);
    try {
      await fetch("/api/portal/exit-view-as", { method: "POST" });
    } finally {
      // Return to the staff Affiliates tab.
      window.location.href = "/partner-program/partners";
    }
  }

  return (
    <div className="sticky top-0 z-50 flex items-center justify-center gap-3 bg-amber-400 px-4 py-2 text-sm font-medium text-amber-950">
      <Eye className="h-4 w-4 shrink-0" />
      <span>
        Admin preview — viewing as <strong>{name}</strong>. Read-only; changes are
        disabled.
      </span>
      <button
        type="button"
        onClick={exit}
        disabled={exiting}
        className="inline-flex items-center gap-1.5 rounded-md bg-amber-950/10 px-2.5 py-1 font-semibold text-amber-950 transition hover:bg-amber-950/20 disabled:opacity-60"
      >
        {exiting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        Exit preview
      </button>
    </div>
  );
}
