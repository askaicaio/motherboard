// =============================================================
// Shared application types
// =============================================================

export type OnboardingStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "provisioning_in_progress"
  | "partially_provisioned"
  | "awaiting_manual_action"
  | "email_sent"
  | "complete"
  | "failed"
  | "offboarded";

export type ToolProvisionStatus =
  | "pending"
  | "in_progress"
  | "success"
  | "failed"
  | "skipped"
  | "manual_required";

export type DivisionType = "b2c" | "b2b" | "sales";

export type AdminRole = "super_admin" | "admin" | "viewer";

export type AuditAction =
  | "request_created"
  | "request_updated"
  | "request_approved"
  | "request_rejected"
  | "provisioning_started"
  | "provisioning_step_started"
  | "provisioning_step_completed"
  | "provisioning_step_failed"
  | "provisioning_retried"
  | "email_generated"
  | "email_sent"
  | "email_resent"
  | "status_changed"
  | "rule_created"
  | "rule_updated"
  | "rule_deleted"
  | "settings_updated"
  | "manual_override"
  | "manual_task_created"
  | "manual_task_completed"
  | "manual_task_assigned"
  | "notification_sent"
  | "offboarding_started"
  | "offboarding_completed"
  | "access_profile_created"
  | "access_profile_updated"
  // Company reports
  | "report_created"
  | "report_research_started"
  | "report_research_completed"
  | "report_research_failed"
  | "report_gamma_started"
  | "report_gamma_completed"
  | "report_gamma_failed"
  | "report_deleted"
  | "report_archived"
  | "report_unarchived";

export type JobType = "onboarding" | "offboarding" | "retry";

export type JobStatus = "pending" | "running" | "completed" | "partially_failed" | "failed";

export type ManualTaskStatus = "pending" | "in_progress" | "completed" | "cancelled";

export type NotificationType =
  | "provisioning_complete"
  | "provisioning_failed"
  | "manual_task_assigned"
  | "approval_needed"
  | "step_retry_needed";

// ---- Company Reports ----
export type ReportStageStatus = "pending" | "running" | "complete" | "failed";

export type ReportTitleFormat = "strategic_growth" | "ebitda_expansion";

export type ReportResearchMode = "deep" | "quick" | "manual";

export const REPORT_RESEARCH_MODES: {
  value: ReportResearchMode;
  label: string;
  description: string;
  estimatedCost: string;
  estimatedDuration: string;
}[] = [
  {
    value: "deep",
    label: "Deep Research",
    description: "Opus 4.7 + xhigh thinking + 15 web searches. Use for real prospects.",
    estimatedCost: "~$3-5",
    estimatedDuration: "~8-12 min",
  },
  {
    value: "quick",
    label: "Quick Research",
    description: "Sonnet 4.6 + medium thinking + 6 web searches. Use for testing/demos.",
    estimatedCost: "~$0.30",
    estimatedDuration: "~2-3 min",
  },
  {
    value: "manual",
    label: "Manual Upload",
    description: "Skip Stage 1 — paste or upload your own pre-written dossier markdown.",
    estimatedCost: "$0",
    estimatedDuration: "Instant",
  },
];

export const REPORT_TITLE_FORMATS: { value: ReportTitleFormat; label: string; description: string }[] = [
  {
    value: "strategic_growth",
    label: "Strategic Growth Through AI",
    description: "Growth-stage companies",
  },
  {
    value: "ebitda_expansion",
    label: "Leveraging Generative AI for Operational Excellence & EBITDA Expansion",
    description: "PE-backed or margin-focused companies",
  },
];

export const REPORT_STAGE_STATUS_CONFIG: Record<ReportStageStatus, { label: string; color: string }> = {
  pending: { label: "Pending", color: "bg-zinc-100 text-zinc-700" },
  running: { label: "Running", color: "bg-blue-100 text-blue-800" },
  complete: { label: "Complete", color: "bg-emerald-100 text-emerald-800" },
  failed: { label: "Failed", color: "bg-red-100 text-red-800" },
};

export const TOOL_KEYS = [
  "google_workspace",
  "slack",
  "clickup",
  "gohighlevel",
  "circle",
  "onepassword",
  "fathom",
  "zoom",
] as const;

export type ToolKey = (typeof TOOL_KEYS)[number];

export const TOOL_DISPLAY_NAMES: Record<ToolKey, string> = {
  google_workspace: "Google Workspace",
  slack: "Slack",
  clickup: "ClickUp",
  gohighlevel: "GoHighLevel",
  circle: "Circle",
  onepassword: "1Password",
  fathom: "Fathom",
  zoom: "Zoom",
};

export const DEPARTMENTS = [
  "Engineering",
  "Marketing",
  "Sales",
  "Operations",
  "Finance",
  "HR",
  "Design",
  "Legal",
  "Executive",
  "Content",
  "Community",
] as const;

export type Department = (typeof DEPARTMENTS)[number];

export const DIVISIONS: { value: DivisionType; label: string }[] = [
  { value: "b2c", label: "B2C" },
  { value: "b2b", label: "B2B" },
  { value: "sales", label: "Sales" },
];

export const ONBOARDING_STATUS_CONFIG: Record<
  OnboardingStatus,
  { label: string; color: string }
> = {
  draft: { label: "Draft", color: "bg-gray-100 text-gray-700" },
  pending_approval: { label: "Pending Approval", color: "bg-yellow-100 text-yellow-800" },
  approved: { label: "Approved", color: "bg-blue-100 text-blue-800" },
  provisioning_in_progress: { label: "Provisioning", color: "bg-indigo-100 text-indigo-800" },
  partially_provisioned: { label: "Partial", color: "bg-orange-100 text-orange-800" },
  awaiting_manual_action: { label: "Manual Action", color: "bg-purple-100 text-purple-800" },
  email_sent: { label: "Email Sent", color: "bg-teal-100 text-teal-800" },
  complete: { label: "Complete", color: "bg-green-100 text-green-800" },
  failed: { label: "Failed", color: "bg-red-100 text-red-800" },
  offboarded: { label: "Offboarded", color: "bg-gray-200 text-gray-600" },
};

export const TOOL_STATUS_CONFIG: Record<
  ToolProvisionStatus,
  { label: string; color: string }
> = {
  pending: { label: "Pending", color: "bg-gray-100 text-gray-700" },
  in_progress: { label: "In Progress", color: "bg-blue-100 text-blue-800" },
  success: { label: "Success", color: "bg-green-100 text-green-800" },
  failed: { label: "Failed", color: "bg-red-100 text-red-800" },
  skipped: { label: "Skipped", color: "bg-gray-100 text-gray-500" },
  manual_required: { label: "Manual Required", color: "bg-purple-100 text-purple-800" },
};

export const MANUAL_TASK_STATUS_CONFIG: Record<ManualTaskStatus, { label: string; color: string }> = {
  pending: { label: "Pending", color: "bg-yellow-100 text-yellow-800" },
  in_progress: { label: "In Progress", color: "bg-blue-100 text-blue-800" },
  completed: { label: "Completed", color: "bg-green-100 text-green-800" },
  cancelled: { label: "Cancelled", color: "bg-gray-100 text-gray-500" },
};

export const JOB_STATUS_CONFIG: Record<JobStatus, { label: string; color: string }> = {
  pending: { label: "Pending", color: "bg-gray-100 text-gray-700" },
  running: { label: "Running", color: "bg-blue-100 text-blue-800" },
  completed: { label: "Completed", color: "bg-green-100 text-green-800" },
  partially_failed: { label: "Partial Failure", color: "bg-orange-100 text-orange-800" },
  failed: { label: "Failed", color: "bg-red-100 text-red-800" },
};

export const EMPLOYMENT_TYPES = [
  { value: "full_time", label: "Full-Time" },
  { value: "part_time", label: "Part-Time" },
  { value: "contractor", label: "Contractor" },
  { value: "intern", label: "Intern" },
] as const;

export const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "Europe/London",
  "Europe/Berlin",
  "Asia/Tokyo",
  "Asia/Kolkata",
  "Australia/Sydney",
  "Pacific/Auckland",
  "UTC",
] as const;
