"use client";

// Per-card API-integration STATUS button on the Automations Main Page.
// (Formerly a "Copy API Key" button; the clipboard-copy behaviour was removed
// 2026-06-11.) Sits to the left of the card's "Open ->" link.
//
// It's now a CLICKABLE live check. On load it shows the last-known state
// (green "API Key Integrated" / red "No API Integration") from the server's
// presence check. Clicking it runs a live verification:
//   click -> white "Checking API Key Status..." (spinner)
//         -> green if the platform's key actually works right now, else red.
// The verification runs server-side (POST /api/automations/check-key); only a
// boolean ever reaches the client, never the secret key.

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Check, Ban, Loader2 } from "lucide-react";
import { useHealthCheckRegistration } from "./api-health-check";

type Status = "checking" | "ok" | "fail";

export function CopyApiKeyButton({
  platform,
  hasApiKey,
  initialOk,
}: {
  platform: string;
  hasApiKey?: boolean;
  /** Last stored health-check result for this platform (manual "API Health
   *  Check" or the auto cron), when one exists. Seeds the green/red state more
   *  accurately than the mere presence check; falls back to hasApiKey when no
   *  check has been recorded for this platform yet. */
  initialOk?: boolean;
}) {
  // Seed from the last stored auto-check result if we have one, else fall back
  // to the server's presence check. The click still does a fresh live verify.
  const seededOk = initialOk === undefined ? !!hasApiKey : initialOk;
  const [status, setStatus] = useState<Status>(seededOk ? "ok" : "fail");

  // Returns { platform, ok } so the fan-out can persist the batch (the click
  // still updates this card's own state live).
  async function check(): Promise<{ platform: string; ok: boolean } | void> {
    if (status === "checking") return;
    setStatus("checking");
    let ok = false;
    try {
      const res = await fetch("/api/automations/check-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean };
      ok = !!(res.ok && data.ok);
    } catch {
      ok = false;
    }
    setStatus(ok ? "ok" : "fail");
    return { platform, ok };
  }

  // Join the Main Page "API Health Check" fan-out: the global button triggers
  // this same check on every card at once. No-op when rendered without the
  // provider (e.g. anywhere else this button is reused).
  useHealthCheckRegistration(check);

  if (status === "checking") {
    return (
      <Button variant="outline" size="sm" disabled className="flex-1">
        <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
        Checking API Key Status…
      </Button>
    );
  }

  if (status === "ok") {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={check}
        className="flex-1 border-green-300 bg-green-50 text-green-700 hover:bg-green-100 hover:text-green-700"
      >
        <Check className="mr-2 h-3.5 w-3.5" />
        API Key Integrated
      </Button>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={check}
      className="flex-1 border-red-300 bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-600"
    >
      <Ban className="mr-2 h-3.5 w-3.5" />
      No API Integration
    </Button>
  );
}
