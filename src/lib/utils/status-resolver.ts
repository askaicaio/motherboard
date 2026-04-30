import type { OnboardingStatus, ToolProvisionStatus } from "@/types";

/**
 * Given the statuses of all provisioning steps for a request,
 * compute the correct aggregate request status.
 *
 * This is a pure function — it has no side effects and can be unit tested.
 */
export function resolveRequestStatus(
  stepStatuses: ToolProvisionStatus[],
  currentStatus: OnboardingStatus,
  emailSent: boolean
): OnboardingStatus {
  if (stepStatuses.length === 0) return currentStatus;

  const hasAnyPending = stepStatuses.some((s) => s === "pending" || s === "in_progress");
  const hasAnyFailed = stepStatuses.some((s) => s === "failed");
  const hasAnyManual = stepStatuses.some((s) => s === "manual_required");
  const allResolved = stepStatuses.every(
    (s) => s === "success" || s === "skipped" || s === "failed" || s === "manual_required"
  );
  const allSuccessOrSkipped = stepStatuses.every(
    (s) => s === "success" || s === "skipped"
  );

  // Still waiting for some steps to complete
  if (hasAnyPending) {
    return "provisioning_in_progress";
  }

  // All steps resolved
  if (allResolved) {
    if (allSuccessOrSkipped) {
      return emailSent ? "complete" : "email_sent";
    }
    if (hasAnyManual && !hasAnyFailed) {
      return "awaiting_manual_action";
    }
    if (hasAnyFailed) {
      // Some succeeded, some failed
      const hasAnySuccess = stepStatuses.some((s) => s === "success");
      return hasAnySuccess ? "partially_provisioned" : "failed";
    }
  }

  return currentStatus;
}
