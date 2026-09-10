"use client";

// ALPHAA1'S OWN COPY of the per-card API-integration status button.
// =============================================================
// ⚠️⚠️ WHY A COPY EXISTS AT ALL, 2026-09-11. The shared
// `@/components/automations/copy-api-key-button` hard-codes `bg-green-50` /
// `bg-red-50` and takes no `className`, so its two states render as near-white
// fills BEHIND TEXT: measured `#F0FDF4` at luminance 0.95 against this page's
// 0.005. Five of them, 409x28 each. **After the window-hierarchy pass they were
// by far the brightest thing on the page and the only surface still breaking
// the rule that light goes on the frame, never behind the text.**
//
// ⚠️ AND THE TAILWIND TRICK DOES NOT REACH THEM. Overriding `--color-green-50`
// on the page root was TESTED in the browser and does nothing: the computed
// background stayed `#F0FDF4`. So the token-override lever that recoloured 41
// other sites on this page (see the page's header note) is not an option here,
// and the only ways left were a copy or a new prop on the shared component.
//
// ⭐ THE USER CHOSE THE COPY, and it is the pattern this folder already uses
// twice: `hover-prefetch-link.tsx` and `nav-indicator.tsx` are both local
// duplicates of the live hub's client leaves. **Version pages are
// self-contained; that is the whole safety property of the scheme.** The live
// hub and the other 15 surfaces that render the shared button are untouched.
//
// 🔁 SO THIS FILE HAS A TWIN AND WILL DRIFT FROM IT. Everything below except
// the three `className` strings is a verbatim copy of the shared component as
// it stood on 2026-09-11. **If the shared one gains behaviour (a new state, a
// different endpoint, a changed prop), this copy does not get it for free.**
// Check both when touching either.
//
// 🎨 THE THREE STATES, AND WHY THEY ARE READOUTS RATHER THAN RAISED CONTROLS:
// the reference draws a status cell as a DARK well with a COLOURED border and
// coloured text (its mech stat cells do exactly this in red). So all three
// states here are `bg-[var(--pa-void)]` with the state's colour on the border
// and the label. **They deliberately do NOT match this page's other two
// buttons** (View list, Error History), which are raised `--pa-inset` chrome:
// those are actions, this is a reading that happens to be clickable.
//
// ⚠️ `variant="outline"` IS KEPT so the copy inherits the same height, radius
// and focus ring as the shared one, but every colour it would contribute is
// overridden. Its `dark:bg-input/30` never applies here (the app's dark variant
// does not engage on this page; `[color-scheme:dark]` only styles form
// controls and scrollbars).
//
// ⬇️ THE SHARED COMPONENT'S OWN HEADER FOLLOWS, inherited with the copy.
// =============================================================
//
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
// ⚠️ IMPORTED FROM THE SHARED MODULE ON PURPOSE, not copied. The registration
// hook reaches the `HealthCheckProvider` through React context, so the copy has
// to use the SAME module instance the page's provider comes from. A local copy
// of the provider would give this button its own empty context and the "API
// Health Check" fan-out would silently skip all five cards.
import { useHealthCheckRegistration } from "@/components/automations/api-health-check";

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

  // Returns { platform, ok } so the fan-out can persist the batch. `persist`
  // (a STANDALONE click on this one card) saves its own result immediately, so
  // that check also triggers the same server-side follow-ups as the fan-out
  // (e.g. turning off this platform's auto-refresh when it's now faulty). The
  // fan-out calls this WITHOUT persist and batches the save itself.
  async function check(opts?: {
    persist?: boolean;
  }): Promise<{ platform: string; ok: boolean } | void> {
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
    if (opts?.persist) {
      void fetch("/api/automations/health-results", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ results: [{ platform, ok }] }),
      }).catch(() => {
        // best-effort; the on-screen result is still updated
      });
    }
    return { platform, ok };
  }

  // Join the Main Page "API Health Check" fan-out: the global button triggers
  // this same check on every card at once. No-op when rendered without the
  // provider (e.g. anywhere else this button is reused).
  useHealthCheckRegistration(check);

  if (status === "checking") {
    return (
      <Button
        variant="outline"
        size="sm"
        disabled
        className="flex-1 border-[var(--pa-line)] bg-[var(--pa-void)] text-[var(--pa-muted)]"
      >
        <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
        Checking API Key Status…
      </Button>
    );
  }

  // NO TOOLTIP on either state, deliberately (user, 2026-08-28). Both had one
  // briefly in the tooltip audit; the user asked for them removed. Do not add
  // them back without being asked.
  if (status === "ok") {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => check({ persist: true })}
        className="flex-1 border-[var(--pa-green)] bg-[var(--pa-void)] text-[var(--pa-green)] hover:bg-[var(--pa-card)] hover:text-[var(--pa-green)]"
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
      onClick={() => check({ persist: true })}
      className="flex-1 border-[var(--pa-red)] bg-[var(--pa-void)] text-[var(--pa-red)] hover:bg-[var(--pa-card)] hover:text-[var(--pa-red)]"
    >
      <Ban className="mr-2 h-3.5 w-3.5" />
      No API Integration
    </Button>
  );
}
