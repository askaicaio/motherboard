import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  date,
  integer,
  numeric,
  jsonb,
  uniqueIndex,
  index,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ========================================================================
// Enums
// ========================================================================

export const onboardingStatusEnum = pgEnum("onboarding_status", [
  "draft",
  "pending_approval",
  "approved",
  "provisioning_in_progress",
  "partially_provisioned",
  "awaiting_manual_action",
  "email_sent",
  "complete",
  "failed",
  "offboarded",
]);

export const toolProvisionStatusEnum = pgEnum("tool_provision_status", [
  "pending",
  "in_progress",
  "success",
  "failed",
  "skipped",
  "manual_required",
]);

export const divisionTypeEnum = pgEnum("division_type", [
  "b2c",
  "b2b",
  "sales",
]);

export const auditActionEnum = pgEnum("audit_action", [
  "request_created",
  "request_updated",
  "request_approved",
  "request_rejected",
  "provisioning_started",
  "provisioning_step_started",
  "provisioning_step_completed",
  "provisioning_step_failed",
  "provisioning_retried",
  "email_generated",
  "email_sent",
  "email_resent",
  "status_changed",
  "rule_created",
  "rule_updated",
  "rule_deleted",
  "settings_updated",
  "manual_override",
  // New audit actions
  "manual_task_created",
  "manual_task_completed",
  "manual_task_assigned",
  "notification_sent",
  "offboarding_started",
  "offboarding_completed",
  "access_profile_created",
  "access_profile_updated",
  // Company reports
  "report_created",
  "report_research_started",
  "report_research_completed",
  "report_research_failed",
  "report_gamma_started",
  "report_gamma_completed",
  "report_gamma_failed",
  "report_deleted",
  "report_archived",
  "report_unarchived",
]);

export const reportStageStatusEnum = pgEnum("report_stage_status", [
  "pending",
  "running",
  "complete",
  "failed",
]);

export const reportTitleFormatEnum = pgEnum("report_title_format", [
  "strategic_growth", // "Strategic Growth Through AI"
  "ebitda_expansion", // "Leveraging Generative AI for Operational Excellence & EBITDA Expansion"
]);

export const reportResearchModeEnum = pgEnum("report_research_mode", [
  "deep", // Opus 4.7 + xhigh effort + 15 searches (~$3-5, ~10 min)
  "quick", // Sonnet 4.6 + medium effort + 6 searches (~$0.30, ~2 min) — for testing/demos
  "manual", // No research call — operator uploads dossier directly
]);

export const jobTypeEnum = pgEnum("job_type", [
  "onboarding",
  "offboarding",
  "retry",
]);

export const manualTaskStatusEnum = pgEnum("manual_task_status", [
  "pending",
  "in_progress",
  "completed",
  "cancelled",
]);

export const provisioningJobStatusEnum = pgEnum("provisioning_job_status", [
  "pending",
  "running",
  "completed",
  "partially_failed",
  "failed",
]);

export const notificationTypeEnum = pgEnum("notification_type", [
  "provisioning_complete",
  "provisioning_failed",
  "manual_task_assigned",
  "approval_needed",
  "step_retry_needed",
]);

// Departments for team members (extend by editing this enum + the
// DEPARTMENTS_LIST constant in src/types/index.ts)
export const departmentEnum = pgEnum("department", [
  "operations",
  "caio_services",
  "sales",
  "marketing",
  "technology",
  "social_media",
  "podcast_support",
  "unassigned",
]);

// ========================================================================
// Tables -- Core
// ========================================================================

export const adminUsers = pgTable("admin_users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  // 'admin' (full access) or 'viewer' (regular member). 'super_admin' kept
  // for backwards compat. UI presents only Admin / User.
  role: text("role").notNull().default("viewer"),
  department: departmentEnum("department").notNull().default("unassigned"),
  /**
   * Job title within the company (e.g. "Senior Account Manager", "Founder").
   * Distinct from `role` which is the platform permission level.
   */
  jobTitle: text("job_title"),
  /** Free-form location (e.g. "Remote — Austin, TX"). */
  location: text("location"),
  /** Direct manager — links to another admin_users row. */
  managerId: uuid("manager_id"),
  /** Personal phone or work cell (optional). */
  phone: text("phone"),
  /** Free-form bio / notes set by the member or admin. */
  bio: text("bio"),
  avatarUrl: text("avatar_url"),
  isActive: boolean("is_active").notNull().default(true),
  // Date the member started (hire/contract start, separate from when their
  // record was created in Motherboard).
  startedAt: timestamp("started_at", { withTimezone: true }),
  // Invite tracking
  invitedAt: timestamp("invited_at", { withTimezone: true }),
  invitedBy: uuid("invited_by"), // self-reference; constraint added below
  /** One-time signup token sent in the invite email; nulled out once consumed. */
  inviteToken: text("invite_token"),
  inviteTokenExpiresAt: timestamp("invite_token_expires_at", { withTimezone: true }),
  /** Optional password hash for email+password sign-in. Google sign-in still works
   *  regardless. Null until member explicitly sets a password during welcome. */
  passwordHash: text("password_hash"),
  // Soft archive (separate from isActive — archived = deactivated AND
  // moved out of the main list)
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  archivedBy: uuid("archived_by"),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const appSettings = pgTable("app_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedBy: uuid("updated_by").references(() => adminUsers.id),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ========================================================================
// Tables -- Access Profiles
// ========================================================================

export const accessProfiles = pgTable("access_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  description: text("description"),
  tools: jsonb("tools").notNull(), // array of tool keys
  toolConfigs: jsonb("tool_configs").notNull().default({}), // map of toolKey -> ProvisioningConfig
  defaultSlackChannels: jsonb("default_slack_channels").default([]),
  defaultGoogleGroups: jsonb("default_google_groups").default([]),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ========================================================================
// Tables -- Onboarding Requests
// ========================================================================

export const onboardingRequests = pgTable(
  "onboarding_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Employee info
    employeeName: text("employee_name").notNull(),
    preferredName: text("preferred_name"),
    employeeEmail: text("employee_email").notNull(),
    personalEmail: text("personal_email"),
    phone: text("phone"),
    jobTitle: text("job_title").notNull(),
    department: text("department").notNull(),
    division: divisionTypeEnum("division").notNull(),
    managerName: text("manager_name"),
    managerEmail: text("manager_email"),
    startDate: date("start_date").notNull(),
    timezone: text("timezone"),
    employmentType: text("employment_type"), // full_time | part_time | contractor
    location: text("location"),
    onboardingOwner: text("onboarding_owner"),
    workEmailPrefix: text("work_email_prefix"),
    notes: text("notes"),
    // Status tracking
    status: onboardingStatusEnum("status").notNull().default("draft"),
    statusChangedAt: timestamp("status_changed_at", { withTimezone: true }).notNull().defaultNow(),
    // Access profile link
    accessProfileId: uuid("access_profile_id").references(() => accessProfiles.id, {
      onDelete: "set null",
    }),
    // Tools requested
    requestedTools: jsonb("requested_tools").notNull().default([]),
    // Advanced config overrides from the form
    slackChannels: jsonb("slack_channels").default([]),
    googleGroups: jsonb("google_groups").default([]),
    clickupAccessType: text("clickup_access_type"),
    onepasswordVaultProfile: text("onepassword_vault_profile"),
    manualOverrideNotes: text("manual_override_notes"),
    // Idempotency
    idempotencyKey: text("idempotency_key").notNull().unique(),
    // Metadata
    createdBy: uuid("created_by").references(() => adminUsers.id),
    approvedBy: uuid("approved_by").references(() => adminUsers.id),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    // Offboarding fields
    offboardedAt: timestamp("offboarded_at", { withTimezone: true }),
    offboardedBy: uuid("offboarded_by").references(() => adminUsers.id, {
      onDelete: "set null",
    }),
    offboardingNotes: text("offboarding_notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_onboarding_status").on(table.status),
    index("idx_onboarding_department").on(table.department),
    index("idx_onboarding_start_date").on(table.startDate),
    index("idx_onboarding_created_at").on(table.createdAt),
    index("idx_onboarding_access_profile").on(table.accessProfileId),
  ]
);

// ========================================================================
// Tables -- Provisioning Steps
// ========================================================================

export const provisioningSteps = pgTable(
  "provisioning_steps",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requestId: uuid("request_id")
      .notNull()
      .references(() => onboardingRequests.id, { onDelete: "cascade" }),
    toolKey: text("tool_key").notNull(),
    status: toolProvisionStatusEnum("status").notNull().default("pending"),
    // Config sent to n8n
    config: jsonb("config").notNull().default({}),
    // Result data from n8n callback
    resultData: jsonb("result_data"),
    errorMessage: text("error_message"),
    // Retry tracking
    attemptCount: integer("attempt_count").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(3),
    lastAttemptedAt: timestamp("last_attempted_at", { withTimezone: true }),
    // Idempotency
    idempotencyKey: text("idempotency_key").notNull().unique(),
    // n8n tracking
    n8nExecutionId: text("n8n_execution_id"),
    // Ordering
    executionOrder: integer("execution_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_prov_request").on(table.requestId),
    index("idx_prov_status").on(table.status),
    uniqueIndex("idx_prov_request_tool").on(table.requestId, table.toolKey),
  ]
);

// ========================================================================
// Tables -- Provisioning Jobs
// ========================================================================

export const provisioningJobs = pgTable(
  "provisioning_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requestId: uuid("request_id")
      .notNull()
      .references(() => onboardingRequests.id, { onDelete: "cascade" }),
    status: provisioningJobStatusEnum("status").notNull().default("pending"),
    jobType: jobTypeEnum("job_type").notNull(),
    triggeredBy: uuid("triggered_by").references(() => adminUsers.id),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    metadata: jsonb("metadata").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_job_request").on(table.requestId),
  ]
);

// ========================================================================
// Tables -- Provisioning Rules
// ========================================================================

export const provisioningRules = pgTable(
  "provisioning_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    description: text("description"),
    // Match conditions (null = matches any)
    matchDepartment: text("match_department"),
    matchDivision: divisionTypeEnum("match_division"),
    matchJobTitle: text("match_job_title"), // supports LIKE patterns
    // What this rule provisions
    toolKey: text("tool_key").notNull(),
    toolConfig: jsonb("tool_config").notNull(),
    // Priority
    priority: integer("priority").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_rules_match").on(table.matchDepartment, table.matchDivision),
  ]
);

// ========================================================================
// Tables -- Role Rules
// ========================================================================

export const roleRules = pgTable(
  "role_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    roleName: text("role_name").notNull(),
    matchDepartment: text("match_department"), // null = any
    matchDivision: divisionTypeEnum("match_division"), // null = any
    accessProfileId: uuid("access_profile_id").references(() => accessProfiles.id, {
      onDelete: "set null",
    }),
    additionalTools: jsonb("additional_tools").notNull().default([]),
    additionalConfig: jsonb("additional_config").notNull().default({}),
    priority: integer("priority").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_role_rules_name").on(table.roleName),
  ]
);

// ========================================================================
// Tables -- Manual Tasks
// ========================================================================

export const manualTasks = pgTable(
  "manual_tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requestId: uuid("request_id")
      .notNull()
      .references(() => onboardingRequests.id, { onDelete: "cascade" }),
    stepId: uuid("step_id").references(() => provisioningSteps.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    description: text("description"),
    toolKey: text("tool_key"),
    status: manualTaskStatusEnum("status").notNull().default("pending"),
    assignedTo: uuid("assigned_to").references(() => adminUsers.id, {
      onDelete: "set null",
    }),
    assignedToEmail: text("assigned_to_email"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    completedBy: uuid("completed_by").references(() => adminUsers.id, {
      onDelete: "set null",
    }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_manual_task_request").on(table.requestId),
    index("idx_manual_task_status").on(table.status),
    index("idx_manual_task_assigned").on(table.assignedTo),
  ]
);

// ========================================================================
// Tables -- Notifications
// ========================================================================

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    recipientId: uuid("recipient_id")
      .notNull()
      .references(() => adminUsers.id, { onDelete: "cascade" }),
    type: notificationTypeEnum("type").notNull(),
    title: text("title").notNull(),
    message: text("message").notNull(),
    isRead: boolean("is_read").notNull().default(false),
    relatedRequestId: uuid("related_request_id").references(() => onboardingRequests.id, {
      onDelete: "set null",
    }),
    relatedTaskId: uuid("related_task_id").references(() => manualTasks.id, {
      onDelete: "set null",
    }),
    metadata: jsonb("metadata").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_notification_recipient").on(table.recipientId),
    index("idx_notification_read").on(table.isRead),
    index("idx_notification_created").on(table.createdAt),
  ]
);

// ========================================================================
// Tables -- Onboarding Emails
// ========================================================================

export const onboardingEmails = pgTable(
  "onboarding_emails",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requestId: uuid("request_id")
      .notNull()
      .references(() => onboardingRequests.id, { onDelete: "cascade" }),
    subject: text("subject").notNull(),
    htmlBody: text("html_body").notNull(),
    plainBody: text("plain_body").notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    sentTo: text("sent_to").notNull(),
    resendCount: integer("resend_count").notNull().default(0),
    messageId: text("message_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("idx_email_request").on(table.requestId)]
);

// ========================================================================
// Tables -- Email Templates
// ========================================================================

export const emailTemplates = pgTable("email_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  description: text("description"),
  subject: text("subject").notNull(), // Handlebars template
  blocks: jsonb("blocks").notNull(), // array of block definitions
  isDefault: boolean("is_default").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  createdBy: uuid("created_by").references(() => adminUsers.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ========================================================================
// Tables -- Audit Logs
// ========================================================================

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    action: auditActionEnum("action").notNull(),
    requestId: uuid("request_id").references(() => onboardingRequests.id, {
      onDelete: "set null",
    }),
    actorId: uuid("actor_id").references(() => adminUsers.id, {
      onDelete: "set null",
    }),
    actorEmail: text("actor_email"),
    details: jsonb("details").notNull().default({}),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_audit_request").on(table.requestId),
    index("idx_audit_action").on(table.action),
    index("idx_audit_created").on(table.createdAt),
    index("idx_audit_actor").on(table.actorId),
  ]
);

// ========================================================================
// Relations
// ========================================================================

export const adminUsersRelations = relations(adminUsers, ({ many }) => ({
  createdRequests: many(onboardingRequests, { relationName: "createdBy" }),
  approvedRequests: many(onboardingRequests, { relationName: "approvedBy" }),
  offboardedRequests: many(onboardingRequests, { relationName: "offboardedBy" }),
  triggeredJobs: many(provisioningJobs),
  assignedTasks: many(manualTasks, { relationName: "assignedTo" }),
  completedTasks: many(manualTasks, { relationName: "completedBy" }),
  notifications: many(notifications),
  auditLogs: many(auditLogs),
  createdEmailTemplates: many(emailTemplates),
}));

export const accessProfilesRelations = relations(accessProfiles, ({ many }) => ({
  onboardingRequests: many(onboardingRequests),
  roleRules: many(roleRules),
}));

export const onboardingRequestsRelations = relations(onboardingRequests, ({ one, many }) => ({
  createdByUser: one(adminUsers, {
    fields: [onboardingRequests.createdBy],
    references: [adminUsers.id],
    relationName: "createdBy",
  }),
  approvedByUser: one(adminUsers, {
    fields: [onboardingRequests.approvedBy],
    references: [adminUsers.id],
    relationName: "approvedBy",
  }),
  offboardedByUser: one(adminUsers, {
    fields: [onboardingRequests.offboardedBy],
    references: [adminUsers.id],
    relationName: "offboardedBy",
  }),
  accessProfile: one(accessProfiles, {
    fields: [onboardingRequests.accessProfileId],
    references: [accessProfiles.id],
  }),
  provisioningSteps: many(provisioningSteps),
  provisioningJobs: many(provisioningJobs),
  manualTasks: many(manualTasks),
  emails: many(onboardingEmails),
  notifications: many(notifications),
}));

export const provisioningStepsRelations = relations(provisioningSteps, ({ one, many }) => ({
  request: one(onboardingRequests, {
    fields: [provisioningSteps.requestId],
    references: [onboardingRequests.id],
  }),
  manualTasks: many(manualTasks),
}));

export const provisioningJobsRelations = relations(provisioningJobs, ({ one }) => ({
  request: one(onboardingRequests, {
    fields: [provisioningJobs.requestId],
    references: [onboardingRequests.id],
  }),
  triggeredByUser: one(adminUsers, {
    fields: [provisioningJobs.triggeredBy],
    references: [adminUsers.id],
  }),
}));

export const manualTasksRelations = relations(manualTasks, ({ one, many }) => ({
  request: one(onboardingRequests, {
    fields: [manualTasks.requestId],
    references: [onboardingRequests.id],
  }),
  step: one(provisioningSteps, {
    fields: [manualTasks.stepId],
    references: [provisioningSteps.id],
  }),
  assignedToUser: one(adminUsers, {
    fields: [manualTasks.assignedTo],
    references: [adminUsers.id],
    relationName: "assignedTo",
  }),
  completedByUser: one(adminUsers, {
    fields: [manualTasks.completedBy],
    references: [adminUsers.id],
    relationName: "completedBy",
  }),
  notifications: many(notifications),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  recipient: one(adminUsers, {
    fields: [notifications.recipientId],
    references: [adminUsers.id],
  }),
  relatedRequest: one(onboardingRequests, {
    fields: [notifications.relatedRequestId],
    references: [onboardingRequests.id],
  }),
  relatedTask: one(manualTasks, {
    fields: [notifications.relatedTaskId],
    references: [manualTasks.id],
  }),
}));

export const onboardingEmailsRelations = relations(onboardingEmails, ({ one }) => ({
  request: one(onboardingRequests, {
    fields: [onboardingEmails.requestId],
    references: [onboardingRequests.id],
  }),
}));

export const emailTemplatesRelations = relations(emailTemplates, ({ one }) => ({
  createdByUser: one(adminUsers, {
    fields: [emailTemplates.createdBy],
    references: [adminUsers.id],
  }),
}));

export const roleRulesRelations = relations(roleRules, ({ one }) => ({
  accessProfile: one(accessProfiles, {
    fields: [roleRules.accessProfileId],
    references: [accessProfiles.id],
  }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  request: one(onboardingRequests, {
    fields: [auditLogs.requestId],
    references: [onboardingRequests.id],
  }),
  actor: one(adminUsers, {
    fields: [auditLogs.actorId],
    references: [adminUsers.id],
  }),
}));

// ========================================================================
// Company Reports — Strategic Growth Reports for prospects
// Two-stage workflow: deep research → Gamma deck generation
// ========================================================================
export const companyReports = pgTable(
  "company_reports",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    // Input — what the operator entered
    companyName: text("company_name").notNull(),
    companyUrl: text("company_url"), // optional — disambiguates the company so research targets the right one
    industry: text("industry"), // optional — research can fill it
    knownDetails: text("known_details"), // free-form context box (revenue, headcount, etc.)
    titleFormat: reportTitleFormatEnum("title_format")
      .notNull()
      .default("strategic_growth"),
    researchMode: reportResearchModeEnum("research_mode")
      .notNull()
      .default("deep"),
    // CAIO representative shown on Slide 10 (CTA). Pre-filled with
    // Dani Apgar by default but editable per-report.
    contactName: text("contact_name"),
    contactEmail: text("contact_email"),
    contactPhone: text("contact_phone"),

    // Stage 1: Deep Research
    researchStatus: reportStageStatusEnum("research_status")
      .notNull()
      .default("pending"),
    /** Sub-stage when researchStatus is "running": "researching" | "distilling" */
    researchPhase: text("research_phase"),
    researchStartedAt: timestamp("research_started_at", { withTimezone: true }),
    researchCompletedAt: timestamp("research_completed_at", {
      withTimezone: true,
    }),
    researchDossier: text("research_dossier"), // Long-form research intelligence (5-25K chars)
    researchMarkdown: text("research_markdown"), // 10-slide markdown distilled from the dossier (sent to Gamma)
    researchError: text("research_error"),
    researchProvider: text("research_provider").default("anthropic"), // 'anthropic' | 'mock'
    researchModel: text("research_model"), // e.g. claude-opus-4-7
    researchSources: jsonb("research_sources")
      .$type<Array<{ url: string; title: string; pageAge?: string }>>()
      .default([]),
    researchInputTokens: integer("research_input_tokens"),
    researchOutputTokens: integer("research_output_tokens"),
    researchCacheReadTokens: integer("research_cache_read_tokens"),
    researchCacheCreationTokens: integer("research_cache_creation_tokens"),
    researchWebSearchCount: integer("research_web_search_count"),
    researchCostUsd: text("research_cost_usd"), // stored as string to preserve precision
    researchThinkingSummary: text("research_thinking_summary"),

    // Stage 2: Gamma Generation
    gammaStatus: reportStageStatusEnum("gamma_status")
      .notNull()
      .default("pending"),
    gammaStartedAt: timestamp("gamma_started_at", { withTimezone: true }),
    gammaCompletedAt: timestamp("gamma_completed_at", { withTimezone: true }),
    gammaGenerationId: text("gamma_generation_id"), // Gamma's API ID
    gammaUrl: text("gamma_url"), // Final shareable Gamma URL
    gammaError: text("gamma_error"),
    gammaCreditsDeducted: integer("gamma_credits_deducted"),
    gammaCreditsRemaining: integer("gamma_credits_remaining"),

    // Archive (soft delete)
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    archivedBy: uuid("archived_by").references(() => adminUsers.id),

    // Audit / ownership
    createdBy: uuid("created_by").references(() => adminUsers.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_reports_created_at").on(table.createdAt),
    index("idx_reports_research_status").on(table.researchStatus),
    index("idx_reports_gamma_status").on(table.gammaStatus),
    index("idx_reports_company").on(table.companyName),
    index("idx_reports_archived_at").on(table.archivedAt),
  ],
);

export const companyReportsRelations = relations(companyReports, ({ one }) => ({
  creator: one(adminUsers, {
    fields: [companyReports.createdBy],
    references: [adminUsers.id],
  }),
}));

// ========================================================================
// Campaigns — webhook-driven marketing campaign tracking
// ========================================================================
//
// Model
// -----
// campaigns ─┬─< campaign_leads >─┬─ campaign_people (deduped across campaigns by email)
//            │                    │
//            └─< campaign_events >┘
//
// Each campaign exposes a per-campaign webhook endpoint
// (/api/campaigns/{id}/webhook/{secret}) that ingests outbound webhook
// payloads from GHL Workflows, Zoom, or any other source. The endpoint
// upserts a campaign_person by email, links it to the campaign via a
// campaign_lead row, and appends a campaign_event with the raw payload.
// ========================================================================

export const campaigns = pgTable(
  "campaigns",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    /** Free-form type — e.g. "webinar" | "email_blast" | "launch" | "event". */
    type: text("type").notNull().default("webinar"),
    /** Human-readable description, optional. */
    description: text("description"),
    /** When the campaign's marquee moment happens (webinar start, launch date). */
    eventDate: timestamp("event_date", { withTimezone: true }),
    /** IANA timezone string used to render eventDate to humans. */
    eventTimezone: text("event_timezone").default("America/New_York"),
    /** "draft" | "active" | "completed" | "archived" */
    status: text("status").notNull().default("active"),
    /** Random URL-safe secret used to authenticate inbound webhooks. */
    webhookSecret: text("webhook_secret").notNull(),
    /** Optional landing-page URL for reference. */
    landingPageUrl: text("landing_page_url"),
    /** Optional GHL workflow/funnel ID for cross-reference. */
    ghlWorkflowId: text("ghl_workflow_id"),

    /**
     * GHL contact tag that identifies signups for this campaign.
     * When set, the cron job /api/cron/sync-ghl-campaigns will pull
     * all contacts with this tag and upsert them as leads.
     * Webhook ingestion still works as a fallback in parallel.
     */
    ghlTag: text("ghl_tag"),
    /** Most recent sync attempt (success or failure). */
    ghlLastSyncedAt: timestamp("ghl_last_synced_at", { withTimezone: true }),
    /** "success" | "failed" | "in_progress" */
    ghlLastSyncStatus: text("ghl_last_sync_status"),
    /** Number of contacts pulled on the most recent successful sync. */
    ghlLastSyncCount: integer("ghl_last_sync_count"),
    /** Human-readable error from the most recent failed sync. */
    ghlLastSyncError: text("ghl_last_sync_error"),

    archivedAt: timestamp("archived_at", { withTimezone: true }),
    archivedBy: uuid("archived_by").references(() => adminUsers.id),

    createdBy: uuid("created_by").references(() => adminUsers.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_campaigns_status").on(table.status),
    index("idx_campaigns_event_date").on(table.eventDate),
    index("idx_campaigns_archived_at").on(table.archivedAt),
    uniqueIndex("uniq_campaigns_webhook_secret").on(table.webhookSecret),
  ],
);

/**
 * One row per unique person across ALL campaigns — deduped by email.
 * The campaign_leads junction connects a person to each campaign they
 * appeared in, so we can show "this lead's full cross-campaign journey".
 */
export const campaignPeople = pgTable(
  "campaign_people",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: text("email").notNull(),
    name: text("name"),
    phone: text("phone"),
    /** GHL contact ID if we know it — lets us deep-link back to GHL. */
    ghlContactId: text("ghl_contact_id"),
    /** Most recent activity across any campaign — for sorting "active leads". */
    lastActivityAt: timestamp("last_activity_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("uniq_campaign_people_email").on(table.email),
    index("idx_campaign_people_last_activity").on(table.lastActivityAt),
    index("idx_campaign_people_ghl").on(table.ghlContactId),
  ],
);

/**
 * Junction: which person appeared in which campaign, with per-campaign
 * source attribution + status. Composite unique on (campaign_id, person_id)
 * means re-submits update the same row instead of duplicating.
 */
export const campaignLeads = pgTable(
  "campaign_leads",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    campaignId: uuid("campaign_id")
      .references(() => campaigns.id, { onDelete: "cascade" })
      .notNull(),
    personId: uuid("person_id")
      .references(() => campaignPeople.id, { onDelete: "cascade" })
      .notNull(),

    /** GHL "source" field or our best guess from referer. */
    source: text("source"),
    utmSource: text("utm_source"),
    utmMedium: text("utm_medium"),
    utmCampaign: text("utm_campaign"),
    utmContent: text("utm_content"),
    utmTerm: text("utm_term"),
    referer: text("referer"),

    /** "registered" | "attended" | "no_show" | "booked_call" | "customer" */
    journeyStage: text("journey_stage").notNull().default("registered"),

    registeredAt: timestamp("registered_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    attendedAt: timestamp("attended_at", { withTimezone: true }),
    bookedCallAt: timestamp("booked_call_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("uniq_campaign_leads_campaign_person").on(
      table.campaignId,
      table.personId,
    ),
    index("idx_campaign_leads_campaign").on(table.campaignId),
    index("idx_campaign_leads_person").on(table.personId),
    index("idx_campaign_leads_journey_stage").on(table.journeyStage),
    index("idx_campaign_leads_utm_source").on(table.utmSource),
  ],
);

/**
 * Event log — every webhook hit becomes a row. Append-only, never updated.
 * Enables the timeline view on the lead detail dialog and full audit trail.
 */
export const campaignEvents = pgTable(
  "campaign_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    campaignId: uuid("campaign_id")
      .references(() => campaigns.id, { onDelete: "cascade" })
      .notNull(),
    /** Lead may be null if the webhook fired before we could resolve a person. */
    leadId: uuid("lead_id").references(() => campaignLeads.id, {
      onDelete: "cascade",
    }),
    personId: uuid("person_id").references(() => campaignPeople.id, {
      onDelete: "cascade",
    }),

    /** "signup" | "attended" | "no_show" | "discovery_call_booked" | "custom" */
    eventType: text("event_type").notNull(),
    /** Free-form payload data we want easy access to (parsed). */
    eventData: jsonb("event_data").default({}),
    /** Full original webhook body — for debugging + future replay. */
    rawPayload: jsonb("raw_payload"),

    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_campaign_events_campaign").on(table.campaignId),
    index("idx_campaign_events_lead").on(table.leadId),
    index("idx_campaign_events_person").on(table.personId),
    index("idx_campaign_events_occurred_at").on(table.occurredAt),
    index("idx_campaign_events_type").on(table.eventType),
  ],
);

export const campaignsRelations = relations(campaigns, ({ many, one }) => ({
  leads: many(campaignLeads),
  events: many(campaignEvents),
  creator: one(adminUsers, {
    fields: [campaigns.createdBy],
    references: [adminUsers.id],
  }),
}));

export const campaignPeopleRelations = relations(campaignPeople, ({ many }) => ({
  leads: many(campaignLeads),
  events: many(campaignEvents),
}));

export const campaignLeadsRelations = relations(campaignLeads, ({ one, many }) => ({
  campaign: one(campaigns, {
    fields: [campaignLeads.campaignId],
    references: [campaigns.id],
  }),
  person: one(campaignPeople, {
    fields: [campaignLeads.personId],
    references: [campaignPeople.id],
  }),
  events: many(campaignEvents),
}));

export const campaignEventsRelations = relations(campaignEvents, ({ one }) => ({
  campaign: one(campaigns, {
    fields: [campaignEvents.campaignId],
    references: [campaigns.id],
  }),
  lead: one(campaignLeads, {
    fields: [campaignEvents.leadId],
    references: [campaignLeads.id],
  }),
  person: one(campaignPeople, {
    fields: [campaignEvents.personId],
    references: [campaignPeople.id],
  }),
}));

// ========================================================================
// Documentation directory — a curated library of links
// ========================================================================
// Each row is a link to an external doc (Google Docs, Notion, Slack canvas,
// etc.). We store light metadata (category, tags, description) so the user
// can organise the list however they like over time. URL parsing happens
// client-side to decide which icon/source badge to render.
// ========================================================================

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    title: text("title").notNull(),
    url: text("url").notNull(),
    /** Short blurb shown under the title — optional. */
    description: text("description"),
    /** Free-form category — autocompletes from existing values in the UI. */
    category: text("category"),
    /** Multi-tag array — text[] in Postgres. Empty array by default. */
    tags: text("tags").array().default([]).notNull(),
    /** Pinned items sort to the top of every view. */
    pinned: boolean("pinned").notNull().default(false),

    archivedAt: timestamp("archived_at", { withTimezone: true }),
    archivedBy: uuid("archived_by").references(() => adminUsers.id),

    createdBy: uuid("created_by").references(() => adminUsers.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_documents_category").on(table.category),
    index("idx_documents_pinned").on(table.pinned),
    index("idx_documents_archived_at").on(table.archivedAt),
    index("idx_documents_created_at").on(table.createdAt),
  ],
);

export const documentsRelations = relations(documents, ({ one }) => ({
  creator: one(adminUsers, {
    fields: [documents.createdBy],
    references: [adminUsers.id],
  }),
}));

// ========================================================================
// Subscriptions — the SaaS / tools spend ledger
// ========================================================================
// Imported from the legacy ClickUp "Accounts" database. Each row tracks
// one paid (or free, or cancelled) account: which service, who owns it,
// what we pay per month, when it renews, and which department(s) use it.
//
// external_id preserves the ClickUp Task ID so re-importing the same CSV
// upserts instead of duplicating. is_starred captures the "*" prefix on
// shared/primary accounts (1Password, Slack, etc).
// ========================================================================

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** ClickUp Task ID from the original CSV — for idempotent re-imports. */
    externalId: text("external_id"),

    /** Full display name as imported (e.g. "ChatGPT | doc@chiefaiofficer.com"). */
    name: text("name").notNull(),
    /** Service portion, parsed from name (e.g. "ChatGPT"). */
    serviceName: text("service_name"),
    /** Owner email portion, parsed from name when present. */
    ownerEmail: text("owner_email"),
    /** True when the imported name had a "*" prefix — shared/primary platform. */
    isStarred: boolean("is_starred").notNull().default(false),

    websiteUrl: text("website_url"),
    /** Multi-value, e.g. ["Marketing","Automations"]. */
    departments: text("departments").array().notNull().default([]),
    inOnePassword: boolean("in_one_password").notNull().default(false),

    /** numeric(12,2) preserves cent precision without JS float drift. */
    monthlyCostUsd: numeric("monthly_cost_usd", { precision: 12, scale: 2 }),
    annualCostUsd: numeric("annual_cost_usd", { precision: 12, scale: 2 }),

    renewalDate: date("renewal_date"),
    notes: text("notes"),
    /** Free-form misc field from the CSV "Tag" column. */
    tag: text("tag"),

    /** "active" | "cancelled" | "paused" | "archived" — defaults to active. */
    status: text("status").notNull().default("active"),

    archivedAt: timestamp("archived_at", { withTimezone: true }),
    archivedBy: uuid("archived_by").references(() => adminUsers.id),

    createdBy: uuid("created_by").references(() => adminUsers.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("uniq_subscriptions_external_id").on(table.externalId),
    index("idx_subscriptions_status").on(table.status),
    index("idx_subscriptions_renewal_date").on(table.renewalDate),
    index("idx_subscriptions_archived_at").on(table.archivedAt),
    index("idx_subscriptions_owner_email").on(table.ownerEmail),
  ],
);

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  creator: one(adminUsers, {
    fields: [subscriptions.createdBy],
    references: [adminUsers.id],
  }),
}));

// ========================================================================
// Automations — inventory of automations/workflows across source websites
// ========================================================================
// One row per automation (a workflow / scenario / zap). Grouped by
// `platform` (which source website); each Per Website Page lists the rows
// for its platform. `externalUrl` is the automation's identity — the link
// used to open it on the source site — so it is unique across the table.

export const automations = pgTable(
  "automations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** Which source website. Matches an AUTOMATION_SITES slug:
     *  'make' | 'n8n' | 'ghl' | 'ghl-b2b' | 'zapier'. */
    platform: text("platform").notNull(),
    /** Column 1 on the per-website table — the automation's visible name. */
    name: text("name").notNull(),
    /** Column 2 — the link to open it on the source site. Treated as the
     *  automation's identity, so it is unique across the table. */
    externalUrl: text("external_url").notNull(),
    /** "active" | "paused" — new rows default to paused. */
    status: text("status").notNull().default("paused"),

    createdBy: uuid("created_by").references(() => adminUsers.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("uniq_automations_external_url").on(table.externalUrl),
    index("idx_automations_platform").on(table.platform),
  ],
);

export const automationsRelations = relations(automations, ({ one }) => ({
  creator: one(adminUsers, {
    fields: [automations.createdBy],
    references: [adminUsers.id],
  }),
}));
