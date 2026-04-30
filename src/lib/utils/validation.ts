import { z } from "zod";

// ---- Onboarding Request ----

export const onboardingRequestSchema = z.object({
  employeeName: z.string().min(2, "Name must be at least 2 characters"),
  preferredName: z.string().optional(),
  employeeEmail: z.string().email("Invalid email address"),
  personalEmail: z.string().email("Invalid email").optional().or(z.literal("")),
  phone: z.string().optional(),
  jobTitle: z.string().min(1, "Job title is required"),
  department: z.string().min(1, "Select a department"),
  division: z.enum(["b2c", "b2b", "sales"], {
    message: "Select a division",
  }),
  managerName: z.string().optional(),
  managerEmail: z.string().email("Invalid email").optional().or(z.literal("")),
  startDate: z.string().min(1, "Start date is required"),
  timezone: z.string().optional(),
  employmentType: z.enum(["full_time", "part_time", "contractor"]).optional(),
  location: z.string().optional(),
  onboardingOwner: z.string().optional(),
  workEmailPrefix: z.string().optional(),
  notes: z.string().optional(),
  requestedTools: z
    .array(z.string())
    .min(1, "Select at least one tool"),
  // Advanced overrides
  slackChannels: z.array(z.string()).optional().default([]),
  googleGroups: z.array(z.string()).optional().default([]),
  clickupAccessType: z.string().optional(),
  onepasswordVaultProfile: z.string().optional(),
  manualOverrideNotes: z.string().optional(),
});

export type OnboardingRequestInput = z.infer<typeof onboardingRequestSchema>;

// ---- Provisioning Rule ----

export const provisioningRuleSchema = z.object({
  name: z.string().min(1, "Rule name is required"),
  description: z.string().optional(),
  matchDepartment: z.string().nullable().optional(),
  matchDivision: z.enum(["b2c", "b2b", "sales"]).nullable().optional(),
  matchJobTitle: z.string().nullable().optional(),
  toolKey: z.string().min(1, "Tool is required"),
  toolConfig: z.record(z.string(), z.unknown()),
  priority: z.number().int().default(0),
  isActive: z.boolean().default(true),
});

export type ProvisioningRuleInput = z.infer<typeof provisioningRuleSchema>;

// ---- Settings ----

export const settingsUpdateSchema = z.record(z.string(), z.unknown());

// ---- Filters ----

export const onboardingListFilterSchema = z.object({
  status: z.string().optional(),
  department: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.string().optional().default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
});

export const auditLogFilterSchema = z.object({
  action: z.string().optional(),
  requestId: z.string().uuid().optional(),
  actorId: z.string().uuid().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});
