"use client";

import { useEffect, useState } from "react";
import { Clock, Presentation, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  startedAt: Date | string;
  status: "pending" | "running" | "complete" | "failed";
  /** Called when operator clicks "Reset stuck job" — only shown after threshold */
  onReset?: () => void;
}

// Gamma's docs say typical generation is 1-3 min. We cap the
// estimated bar at 90% over 180s; the last 10% fills only when
// the API actually returns "completed".
const ESTIMATED_TOTAL_MS = 3 * 60 * 1000; // 3 min
const STUCK_THRESHOLD_MS = 8 * 60 * 1000; // 8 min — Gamma should be done long before this

function formatElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, "0")}`;
}

export function GammaProgress({ startedAt, status, onReset }: Props) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (status !== "running") return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [status]);

  const start =
    typeof startedAt === "string"
      ? new Date(startedAt).getTime()
      : startedAt.getTime();
  const elapsedMs = Math.max(0, now - start);

  // Estimated progress: climb to 90% over the typical duration.
  // The final 10% only fills on actual completion.
  let estimatedProgress = 0;
  if (status === "running") {
    estimatedProgress = Math.min(90, (elapsedMs / ESTIMATED_TOTAL_MS) * 90);
  } else if (status === "complete") {
    estimatedProgress = 100;
  }

  const isStuck = status === "running" && elapsedMs > STUCK_THRESHOLD_MS;
  const elapsedLabel = formatElapsed(elapsedMs);

  // Phase messaging based on elapsed time (Gamma doesn't expose
  // sub-stage progress, so we approximate based on typical duration)
  let phaseMessage = "Submitting to Gamma...";
  if (elapsedMs > 10_000) phaseMessage = "Designing slide layouts...";
  if (elapsedMs > 45_000) phaseMessage = "Sourcing images and refining...";
  if (elapsedMs > 90_000) phaseMessage = "Almost there — finalizing deck...";
  if (elapsedMs > 180_000) phaseMessage = "Taking longer than usual...";

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 rounded-md border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs text-indigo-900">
        <Presentation className="h-3.5 w-3.5 shrink-0" />
        <span className="font-medium">Generating Gamma deck</span>
        <span className="ml-auto text-indigo-700/80">
          Pexels stock photography · 16x9 format
        </span>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-zinc-600 font-medium">{phaseMessage}</span>
          <span className="font-mono text-zinc-500">
            <Clock className="h-3 w-3 inline -mt-0.5 mr-1" />
            {elapsedLabel}
            {!isStuck && status === "running" && (
              <span className="text-zinc-400">
                {" / "}~{formatElapsed(ESTIMATED_TOTAL_MS)} typical
              </span>
            )}
          </span>
        </div>
        <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-1000 ease-out",
              status === "complete"
                ? "bg-emerald-500"
                : status === "failed"
                  ? "bg-red-500"
                  : "bg-gradient-to-r from-indigo-500 to-purple-500",
              status === "running" && "animate-pulse",
            )}
            style={{ width: `${estimatedProgress}%` }}
          />
        </div>
      </div>

      {isStuck && onReset && (
        <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <div className="flex-1">
            <strong>Running for {elapsedLabel}.</strong> Gamma typically
            finishes in 1-3 minutes. The job may be stuck or have errored.
            Check the{" "}
            <a
              href="https://app.inngest.com/env/production/runs"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-medium"
            >
              Inngest dashboard
            </a>{" "}
            to confirm before resetting.
          </div>
          <button
            onClick={onReset}
            className="rounded bg-amber-900 text-white px-3 py-1.5 text-xs font-medium hover:bg-amber-800 shrink-0"
          >
            Reset & retry
          </button>
        </div>
      )}
    </div>
  );
}
