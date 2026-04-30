"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ToolStatusBadge } from "./status-badge";
import { TOOL_DISPLAY_NAMES, type ToolKey, type ToolProvisionStatus } from "@/types";
import {
  Mail, MessageSquare, CheckSquare, Megaphone, Users, KeyRound, RefreshCw,
} from "lucide-react";

const TOOL_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  google_workspace: Mail,
  slack: MessageSquare,
  clickup: CheckSquare,
  gohighlevel: Megaphone,
  circle: Users,
  onepassword: KeyRound,
};

interface ProvisioningStep {
  id: string;
  toolKey: string;
  status: ToolProvisionStatus;
  errorMessage?: string | null;
  attemptCount: number;
  maxAttempts: number;
  resultData?: Record<string, unknown> | null;
  lastAttemptedAt?: string | null;
}

interface ProvisioningTrackerProps {
  steps: ProvisioningStep[];
  onRetry: (stepIds: string[]) => void;
  isRetrying: boolean;
}

export function ProvisioningTracker({ steps, onRetry, isRetrying }: ProvisioningTrackerProps) {
  const failedSteps = steps.filter((s) => s.status === "failed");

  return (
    <div className="space-y-4">
      {failedSteps.length > 0 && (
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onRetry(failedSteps.map((s) => s.id))}
            disabled={isRetrying}
          >
            <RefreshCw className="mr-2 h-3 w-3" />
            {isRetrying ? "Retrying..." : `Retry All Failed (${failedSteps.length})`}
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {steps.map((step) => {
          const Icon = TOOL_ICONS[step.toolKey] || Mail;
          const displayName = TOOL_DISPLAY_NAMES[step.toolKey as ToolKey] || step.toolKey;
          const canRetry = step.status === "failed" && step.attemptCount < step.maxAttempts;

          return (
            <Card key={step.id} className="relative">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-zinc-500" />
                    <CardTitle className="text-sm font-medium">{displayName}</CardTitle>
                  </div>
                  <ToolStatusBadge status={step.status} />
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                {step.errorMessage && (
                  <p className="mb-2 text-xs text-red-600 bg-red-50 rounded p-2">
                    {step.errorMessage}
                  </p>
                )}
                <div className="flex items-center justify-between text-xs text-zinc-400">
                  <span>
                    Attempt {step.attemptCount}/{step.maxAttempts}
                  </span>
                  {canRetry && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs"
                      onClick={() => onRetry([step.id])}
                      disabled={isRetrying}
                    >
                      <RefreshCw className="mr-1 h-3 w-3" />
                      Retry
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {steps.length === 0 && (
        <div className="rounded-md border border-dashed p-8 text-center text-sm text-zinc-400">
          No provisioning steps yet. Approve the request to generate steps.
        </div>
      )}
    </div>
  );
}
