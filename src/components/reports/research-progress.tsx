"use client";

import { useEffect, useState } from "react";
import { Sparkles, Presentation, CheckCircle2, AlertTriangle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  startedAt: Date | string;
  phase: "researching" | "distilling" | null;
  status: "pending" | "running" | "complete" | "failed";
  /** Research mode — affects estimated duration and stage labels */
  mode?: "deep" | "quick" | "manual" | null;
  /** Called when the operator clicks "Reset stuck job" — only visible after threshold */
  onReset?: () => void;
}

// Mode-specific time estimates
const ESTIMATES = {
  deep: {
    stage1Ms: 8 * 60 * 1000, // 8 min typical
    stage2Ms: 90 * 1000, // 1.5 min typical
    stuckThresholdMs: 45 * 60 * 1000, // 45 min
    stage1Label: "Deep Research",
  },
  quick: {
    stage1Ms: 2 * 60 * 1000, // 2 min typical
    stage2Ms: 60 * 1000, // 1 min typical
    stuckThresholdMs: 15 * 60 * 1000, // 15 min — Sonnet should be much faster
    stage1Label: "Quick Research",
  },
  manual: {
    // Manual mode skips Stage 1, only Stage 2 runs
    stage1Ms: 0,
    stage2Ms: 90 * 1000,
    stuckThresholdMs: 10 * 60 * 1000,
    stage1Label: "Manual",
  },
} as const;

function formatElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, "0")}`;
}

export function ResearchProgress({ startedAt, phase, status, mode, onReset }: Props) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (status !== "running") return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [status]);

  const estimates = ESTIMATES[mode ?? "deep"];
  const ESTIMATED_TOTAL_MS = estimates.stage1Ms + estimates.stage2Ms;

  const start = typeof startedAt === "string" ? new Date(startedAt).getTime() : startedAt.getTime();
  const elapsedMs = Math.max(0, now - start);

  // Estimated progress: 0-80% during researching, 80-95% during distilling
  let estimatedProgress = 0;
  if (phase === "researching") {
    estimatedProgress = Math.min(80, (elapsedMs / Math.max(1, estimates.stage1Ms)) * 80);
  } else if (phase === "distilling") {
    const distillElapsed = Math.max(0, elapsedMs - estimates.stage1Ms);
    estimatedProgress = 80 + Math.min(15, (distillElapsed / estimates.stage2Ms) * 15);
  } else if (status === "complete") {
    estimatedProgress = 100;
  }

  const isStuck = status === "running" && elapsedMs > estimates.stuckThresholdMs;
  const elapsedLabel = formatElapsed(elapsedMs);

  return (
    <div className="space-y-3">
      {/* Stage indicators */}
      <div className="grid grid-cols-2 gap-2">
        <StageIndicator
          number={1}
          label={estimates.stage1Label}
          icon={<Sparkles className="h-3.5 w-3.5" />}
          state={getStage1State(phase, status)}
        />
        <StageIndicator
          number={2}
          label="Slide Distillation"
          icon={<Presentation className="h-3.5 w-3.5" />}
          state={getStage2State(phase, status)}
        />
      </div>

      {/* Progress bar */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-zinc-600 font-medium">
            {phase === "researching" && "Searching the web and assembling the dossier..."}
            {phase === "distilling" && "Distilling dossier into the 10-slide deck..."}
            {!phase && status === "running" && "Starting up..."}
            {status === "complete" && "Complete"}
            {status === "failed" && "Failed"}
          </span>
          <span className="font-mono text-zinc-500">
            <Clock className="h-3 w-3 inline -mt-0.5 mr-1" />
            {elapsedLabel}
            {!isStuck && status === "running" && phase && (
              <span className="text-zinc-400">
                {" / "}
                ~{formatElapsed(ESTIMATED_TOTAL_MS)} typical
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
                  : "bg-gradient-to-r from-purple-500 to-indigo-500",
              status === "running" && "animate-pulse",
            )}
            style={{ width: `${estimatedProgress}%` }}
          />
        </div>
      </div>

      {/* Long-running job notice (only after 45+ min) */}
      {isStuck && onReset && (
        <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <div className="flex-1">
            <strong>Running for {elapsedLabel}.</strong> This is unusually long
            even for thorough research. Check the{" "}
            <a
              href="https://app.inngest.com/env/production/runs"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-medium"
            >
              Inngest dashboard
            </a>{" "}
            to see if the job is genuinely stuck. Only reset if you confirm
            the run has failed there.
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

type StageState = "pending" | "active" | "done" | "failed";

function getStage1State(
  phase: Props["phase"],
  status: Props["status"],
): StageState {
  if (phase === "researching") return "active";
  if (phase === "distilling") return "done"; // already moved past stage 1
  if (status === "complete") return "done";
  if (status === "failed") return "failed";
  return "pending";
}

function getStage2State(
  phase: Props["phase"],
  status: Props["status"],
): StageState {
  if (phase === "distilling") return "active";
  if (status === "complete") return "done";
  if (status === "failed" && phase === null) {
    // Failed at stage 2 — phase was cleared
    return "failed";
  }
  return "pending";
}

function StageIndicator({
  number,
  label,
  icon,
  state,
}: {
  number: number;
  label: string;
  icon: React.ReactNode;
  state: StageState;
}) {
  const styles = {
    pending: "border-zinc-200 bg-zinc-50 text-zinc-400",
    active: "border-purple-300 bg-purple-50 text-purple-900 animate-pulse",
    done: "border-emerald-300 bg-emerald-50 text-emerald-900",
    failed: "border-red-300 bg-red-50 text-red-900",
  }[state];

  return (
    <div className={cn("flex items-center gap-2 rounded-md border px-3 py-2 text-xs", styles)}>
      <span
        className={cn(
          "flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold shrink-0",
          state === "done" && "bg-emerald-600 text-white",
          state === "active" && "bg-purple-600 text-white",
          state === "pending" && "bg-zinc-200 text-zinc-500",
          state === "failed" && "bg-red-600 text-white",
        )}
      >
        {state === "done" ? <CheckCircle2 className="h-3 w-3" /> : number}
      </span>
      <div className="flex items-center gap-1.5 flex-1 min-w-0">
        {icon}
        <span className="font-medium truncate">{label}</span>
      </div>
    </div>
  );
}
