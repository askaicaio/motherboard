"use client";

// AlphaA3's copy of the per-website API key button, THEMED BY ROLE TOKENS.
// =============================================================
// 🔁 A LOCAL FORK, like AlphaA1's. The shared
// `@/components/automations/copy-api-key-button` hard-codes `bg-green-50` /
// `bg-red-50` and takes no `className`, so it cannot be themed from outside.
// **Behaviour below is identical to the shared one**; only the class strings
// differ. Fix a BUG there and fix it here too.
//
// 📌 GREEN AND RED SURVIVE IN BOTH THEMES, and that is the page's one documented
// exception to "three colours by meaning". This is the only ON/OFF pair rendered
// at the same shape and size five times in a column, so it is SCANNED rather
// than read, and blue/red do not separate at a glance the way green/red do. The
// user reverted an earlier move to blue the same day it shipped: "the previous
// color of the these buttons were better, use those."
//
// 📌 NO `dark:` VARIANTS HERE, AND THERE WERE SOME BRIEFLY. While AlphaA3's root
// carried shadcn's `dark` class, the outline variant's own dark rules
// (`dark:border-input dark:bg-input/30 dark:hover:bg-input/50` in `button.tsx`)
// fired and repainted this button shadcn grey on a palette page, so every class
// had to be restated under `dark:` to beat them. **The root is themed by a
// `data-` attribute now, so those rules never fire and the duplicates are gone.**
// See `A3_THEME_ATTR` in `theme.tsx` for why the class went away.
// =============================================================

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Check, Ban, Loader2 } from "lucide-react";
import { useHealthCheckRegistration } from "@/components/automations/api-health-check";

type Status = "checking" | "ok" | "fail";

const CHECKING =
  "flex-1 border-[var(--a-key-line)] bg-[var(--a-key-bg)] text-[var(--a-key-text)]";

const OK =
  "flex-1 border-[var(--a-key-ok-line)] bg-[var(--a-key-ok-bg)] text-[var(--a-key-ok-text)] hover:bg-[var(--a-key-ok-hover)] hover:text-[var(--a-key-ok-text)]";

const FAIL =
  "flex-1 border-[var(--a-key-bad-line)] bg-[var(--a-key-bad-bg)] text-[var(--a-key-bad-text)] hover:bg-[var(--a-key-bad-hover)] hover:text-[var(--a-key-bad-text)]";

export function CopyApiKeyButton({
  platform,
  hasApiKey,
  initialOk,
}: {
  platform: string;
  hasApiKey?: boolean;
  initialOk?: boolean;
}) {
  /** Seeded from the last stored health result when there is one, so the button
   *  does not spend its first render claiming a key works when the most recent
   *  check said otherwise. Falls back to "a key exists" when nothing is stored. */
  const seededOk = initialOk === undefined ? !!hasApiKey : initialOk;
  const [status, setStatus] = useState<Status>(seededOk ? "ok" : "fail");

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
        // Storing the result is best-effort; the button already shows the
        // truth for this visit.
      });
    }
    return { platform, ok };
  }

  useHealthCheckRegistration(check);

  if (status === "checking") {
    return (
      <Button variant="outline" size="sm" disabled className={CHECKING}>
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
        className={OK}
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
      className={FAIL}
    >
      <Ban className="mr-2 h-3.5 w-3.5" />
      No API Integration
    </Button>
  );
}
