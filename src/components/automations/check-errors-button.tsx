"use client";

// "Check for New Errors" button on the Per Website Error History page.
//
// For an error-capture platform (Make): POSTs /api/automations/capture-errors,
// which makes the background sweep DUE so the next 5-min cron runs it,
// unattended. Returns instantly — the user can close the app. New errors appear
// on the page within a few minutes (reload to see them).
//
// For platforms without error capture yet (n8n / ghl / ghl-b2b / zapier): a
// PLACEHOLDER — clicking just shows red error text that fades after 5s (the
// standing default for transient inline errors). No API call.

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function CheckErrorsButton({
  platform,
  canCapture = false,
}: {
  platform: string;
  /** True only for platforms whose error capture is built (Make). Others get
   *  the placeholder red-error behaviour. */
  canCapture?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const errorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (errorTimer.current) clearTimeout(errorTimer.current);
    };
  }, []);

  // Red error under the button for 5s, then auto-fade.
  const showError = (message: string) => {
    setError(message);
    if (errorTimer.current) clearTimeout(errorTimer.current);
    errorTimer.current = setTimeout(() => setError(null), 5000);
  };

  const handleClick = async () => {
    // Placeholder platforms: capture isn't built yet -> red error, no call.
    if (!canCapture) {
      showError("Error tracking isn't set up for this website yet.");
      return;
    }

    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/automations/capture-errors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Couldn't start the check.");

      if (data.queued) {
        toast.success(
          "Checking for new errors. New ones appear here within a few minutes — reload the page to see them.",
        );
      } else if (data.reason === "pending") {
        toast("A check is already queued. New errors will appear here shortly.");
      } else if (data.reason === "recent") {
        toast("Just checked a moment ago. Give it a minute, then try again.");
      } else {
        toast.success("Check requested.");
      }
    } catch (err) {
      showError(err instanceof Error ? err.message : "Couldn't start the check.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative">
      <Button
        size="sm"
        onClick={handleClick}
        disabled={busy}
        className={cn(
          error &&
            "bg-red-600 text-white hover:bg-red-600 focus-visible:ring-red-600/50",
        )}
      >
        <RefreshCw className={cn("mr-2 h-3.5 w-3.5", busy && "animate-spin")} />
        {busy ? "Checking…" : "Check for New Errors"}
      </Button>
      {error && (
        <p
          role="alert"
          className="absolute right-0 top-full z-10 mt-1 max-w-xs text-right text-xs font-medium text-red-600"
        >
          {error}
        </p>
      )}
    </div>
  );
}
