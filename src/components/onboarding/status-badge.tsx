import { Badge } from "@/components/ui/badge";
import {
  ONBOARDING_STATUS_CONFIG,
  TOOL_STATUS_CONFIG,
  type OnboardingStatus,
  type ToolProvisionStatus,
} from "@/types";
import { cn } from "@/lib/utils";

export function OnboardingStatusBadge({ status }: { status: OnboardingStatus }) {
  const config = ONBOARDING_STATUS_CONFIG[status];
  return (
    <Badge variant="outline" className={cn("font-medium", config.color)}>
      {config.label}
    </Badge>
  );
}

export function ToolStatusBadge({ status }: { status: ToolProvisionStatus }) {
  const config = TOOL_STATUS_CONFIG[status];
  return (
    <Badge variant="outline" className={cn("font-medium text-xs", config.color)}>
      {config.label}
    </Badge>
  );
}
