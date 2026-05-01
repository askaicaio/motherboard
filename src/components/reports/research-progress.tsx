"use client";

import { useEffect, useState } from "react";
import { Sparkles, Presentation, CheckCircle2, AlertTriangle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  startedAt: Date | string;
  phase: "researching" | "distilling" | null;
  status: "pending" | "running" | "complete" | "failed";
  /** Called when the operator clicks "Reset stuck job" — only visible after 10 min */
  onReset?: () => void;
}

const STUCK_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes
const ESTIMATED_STAGE_1_MS = 4 * 60 * 1000; // 4 minutes typical
const ESTIMATED_STAGE_2_MS = 60 * 1000; // 1 minute typical
const ESTIMATED_TOTAL_MS = ESTIMATED_STAGE_1_MS + ESTIMATED_STAGE_2_MS;

function formatElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, "0")}`;
}

export function ResearchProgress({ startedAt, phase, status, onReset }: Props) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (status !== "running") return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [status]);

  const start = typeof startedAt === "string" ? new Date(startedAt).getTime() : startedAt.getTime();
  const elapsedMs = Math.max(0, now - start);

  // Estimated progress: 0-80% during researching, 80-100% during distilling
  let estimatedProgress = 0;
  if (phase === "researching") {
    // 0% to 80% over the estimated stage 1 duration
    estimatedProgress = Math.min(80, (elapsedMs / ESTIMATED_STAGE_1_MS) * 80);
  } else if (phase === "distilling") {
    // Already 80%, climb to 95% over stage 2 (leaves 5% for actual completion)
    const distillElapsed = Math.max(0, elapsedMs - ESTIMATED_STAGE_1_MS);
    estimatedProgress = 80 + Math.min(15, (distillElapsed / ESTIMATED_STAGE_2_MS) * 15);
  } else if (status === "complete") {
    estimatedProgress = 100;
  }

  const isStuck = status === "running" && elapsedMs > STUCK_THRESHOLD_MS;
  const elapsedLabel = formatElapsed(elapsedMs);

  return (
    <div className="space-y-3">
      {/* Stage indicators */}
      <div className="grid grid-cols-2 gap-2">
        <StageIndicator
          number={1}
          label="Deep Research"
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

      {/* Stuck job recovery */}
      {isStuck && onReset && (
        <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <div className="flex-1">
            <strong>This job has been running for {elapsedLabel}.</strong>{" "}
            Vercel functions time out after 5 minutes — the server-side process
            may have died. You can reset and retry.
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
