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
import { relations, sql } from "drizzle-orm";

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
    /**
     * Day of the month (1-31) for monthly-recurring subs (e.g. "billed
     * every 20th"). When non-null, takes precedence over renewal_date for
     * display and "renews soon" calculations — we compute the next
     * occurrence on the fly. Null = one-time or yearly, uses renewal_date.
     */
    renewalDayOfMonth: integer("renewal_day_of_month"),
    notes: text("notes"),
    /** Free-form misc field from the CSV "Tag" column. */
    tag: text("tag"),

    /** "active" | "cancelled" | "paused" | "archived" — defaults to active. */
    status: text("status").notNull().default("active"),

    /**
     * Self-reference for parent/child nesting (e.g. Claude Team Plan
     * owns the seat rows). Children always inherit the parent's billing
     * — they typically have monthly_cost_usd = NULL. NULL = top-level.
     */
    parentId: uuid("parent_id"),

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
    /** Free-text note describing what the automation is for. Optional
     *  (nullable). Shown via the Purpose column's "Show"/"None" button and
     *  edited in the Add/Edit Workflow dialog. */
    purpose: text("purpose"),
    /** When this automation last ran on its source platform. Nullable; filled
     *  only by the sync (Refresh List / auto-refresh), never manually. Shown in
     *  the "Last Runtime" column formatted MM-DD-YYYY ("-" when null). */
    lastRunAt: timestamp("last_run_at", { withTimezone: true }),
    /** When this automation was last EDITED/modified on its source platform
     *  (distinct from last_run_at). Nullable; filled by the sync (n8n + GHL
     *  `updatedAt`, Make `lastEdit`) or the one-time Zapier CSV import, never
     *  set through the Add/Edit dialog. Shown in the "Last Edited" column
     *  formatted MM-DD-YYYY ("-" when null). Unlike last_run_at, GHL DOES expose
     *  this (workflow `updatedAt`), so it is populated for all synced platforms. */
    lastEditedAt: timestamp("last_edited_at", { withTimezone: true }),

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

// ========================================================================
// Partner Program (affiliate system)
// ========================================================================
// Custom, fully-owned affiliate / referral program. Rules sourced from
// `#affiliate-files/06.2026 CAIO_Partner_Program_Terms.docx` and the
// Playbook. Money is integer cents everywhere; rates and windows are
// config-driven via partner_settings (append-only history), never
// hardcoded.
//
// Architecture mirrors campaigns + campaign_events: partners own
// attribution events, conversions are the central ledger, and
// partner_conversion_events is the append-only audit log of lifecycle
// transitions.
// ========================================================================

/**
 * Affiliates themselves. Status lifecycle:
 *   applied -> approved -> active (the happy path)
 *   applied -> declined (rejected at intake)
 *   active  -> suspended / terminated (post-issue actions)
 */
export const partners = pgTable(
  "partners",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** 8-char base62 URL-safe code used in ?aff=. Unique. */
    refCode: text("ref_code").notNull(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    company: text("company"),
    /** applied | approved | declined | active | suspended | terminated */
    status: text("status").notNull().default("applied"),
    /** none | w9 | w8ben | w8bene | invalid — payout blocked unless w9/w8ben/w8bene */
    taxFormStatus: text("tax_form_status").notNull().default("none"),
    /** ach | zelle | none */
    payoutMethod: text("payout_method").notNull().default("none"),
    /** Free-form per-partner payout instructions (bank routing notes, Zelle handle, etc). Never logged. */
    payoutDetails: text("payout_details"),
    /** GHL contact id once we mirror to GHL — populated by the future ghl-affiliate-sync cron. */
    ghlContactId: text("ghl_contact_id"),
    /** Free-form admin notes (referral source, special arrangements, etc). */
    notes: text("notes"),

    // ---- Partner portal auth (isolated from staff NextAuth) ----
    /** bcrypt hash for the partner's portal login. Null until they set one. */
    passwordHash: text("password_hash"),
    /** One-time token for set-password / reset links (emailed). */
    passwordToken: text("password_token"),
    passwordTokenExpiresAt: timestamp("password_token_expires_at", {
      withTimezone: true,
    }),
    portalLastLoginAt: timestamp("portal_last_login_at", { withTimezone: true }),
    /** Set true when a temp password is issued at approval — first login forces a change. */
    mustChangePassword: boolean("must_change_password").notNull().default(false),

    // ---- Onboarding questionnaire (apply form) ----
    /** Private Vercel Blob URL of the uploaded W-9 / W-8BEN PDF. */
    taxFormUrl: text("tax_form_url"),
    taxFormName: text("tax_form_name"),
    dateOfBirth: date("date_of_birth"),
    address: text("address"),
    city: text("city"),
    state: text("state"),
    postalCode: text("postal_code"),
    country: text("country"),
    audienceSize: integer("audience_size"),
    /** Full questionnaire payload (platforms, target audience, experience levels, signature, etc.). */
    applicationData: jsonb("application_data").notNull().default({}),
    /** Seeded/demo affiliate — badged "SAMPLE ONLY" and excluded from admin stats. */
    isSample: boolean("is_sample").notNull().default(false),

    // ---- Stripe Connect (automatic payouts) ----
    stripeConnectAccountId: text("stripe_connect_account_id"),
    /** none | onboarding | ready | restricted */
    stripeConnectStatus: text("stripe_connect_status").notNull().default("none"),

    appliedAt: timestamp("applied_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    approvedBy: uuid("approved_by").references(() => adminUsers.id),
    declinedAt: timestamp("declined_at", { withTimezone: true }),
    declineReason: text("decline_reason"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("uniq_partners_ref_code").on(table.refCode),
    uniqueIndex("uniq_partners_email").on(table.email),
    index("idx_partners_status").on(table.status),
    index("idx_partners_ghl").on(table.ghlContactId),
  ],
);

/**
 * Append-only configuration history. Per-conversion math pulls the
 * active row AS OF purchased_at:
 *   WHERE effective_from <= purchased_at
 *   ORDER BY effective_from DESC LIMIT 1
 *
 * Rates stored as text (e.g. "0.10") to avoid float drift; parse to
 * decimal in application code. Cents fields are integer cents.
 */
export const partnerSettings = pgTable(
  "partner_settings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    cookieWindowDays: integer("cookie_window_days").notNull().default(60),
    /** Stored as text to avoid binary float drift, e.g. "0.10" for 10%. */
    defaultCommissionRate: text("default_commission_rate")
      .notNull()
      .default("0.10"),
    refundWindowDays: integer("refund_window_days").notNull().default(7),
    payoutTermsDays: integer("payout_terms_days").notNull().default(45),
    minPayoutCents: integer("min_payout_cents").notNull().default(10000),
    /** Day of month (1–28) the auto-payout cron generates the batch. */
    payoutDayOfMonth: integer("payout_day_of_month").notNull().default(1),
    effectiveFrom: timestamp("effective_from", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: uuid("created_by").references(() => adminUsers.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("uniq_partner_settings_effective_from").on(table.effectiveFrom),
  ],
);

/**
 * Eligible programs. Seeded with the 6 from the Landing Page Copy.
 * setup_fee_cents + stripe_fee_passthrough_cents are subtracted from
 * gross at conversion time per Terms §3.3 — commission basis is NOT
 * list price.
 */
export const partnerPrograms = pgTable(
  "partner_programs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    /** URL-friendly slug for landing-page routes. */
    slug: text("slug").notNull(),
    /** List price in cents (display only — not the commission basis). */
    listValueCents: integer("list_value_cents").notNull(),
    /** Per-program rate override (nullable — falls back to partner_settings default). */
    commissionRateOverride: text("commission_rate_override"),
    /** True when the program closes via conversation (Strategic Oversight, Embedded Fractional CAIO). */
    salesLed: boolean("sales_led").notNull().default(false),
    active: boolean("active").notNull().default(true),
    /** Soft-delete: archived programs disappear from affiliate-facing surfaces but stay for history. */
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdBy: uuid("created_by"),
    /** Dummy/test product — badged "SAMPLE ONLY". */
    isSample: boolean("is_sample").notNull().default(false),
    /** Set when the program is wired into Stripe (self-serve checkout). */
    stripeProductId: text("stripe_product_id"),
    stripePriceId: text("stripe_price_id"),
    /** Non-commissionable setup fee bundled in the list price (e.g. onboarding). */
    setupFeeCents: integer("setup_fee_cents").notNull().default(0),
    /** Stripe processing fee passed through to buyer as a line item — non-commissionable per Terms §3.3. */
    stripeFeePassthroughCents: integer("stripe_fee_passthrough_cents")
      .notNull()
      .default(0),

    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("uniq_partner_programs_slug").on(table.slug),
    index("idx_partner_programs_active").on(table.active),
  ],
);

/** Append-only click log. Cookie window check uses created_at, NOT cookie age. */
export const partnerClicks = pgTable(
  "partner_clicks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    partnerId: uuid("partner_id")
      .references(() => partners.id, { onDelete: "cascade" })
      .notNull(),
    refCode: text("ref_code").notNull(),
    /** UUID that ties the click to the cookie issued to the browser. */
    cookieId: uuid("cookie_id").notNull(),
    ip: text("ip"),
    userAgent: text("user_agent"),
    referrer: text("referrer"),
    landingPath: text("landing_path"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_partner_clicks_partner").on(table.partnerId),
    index("idx_partner_clicks_cookie").on(table.cookieId),
    index("idx_partner_clicks_created_at").on(table.createdAt),
  ],
);

/**
 * Attribution events. tracked_link comes from a click; direct_intro is
 * admin-entered for sales-led deals. is_valid=false when the intro was
 * logged AFTER the proposal went out (Playbook §13) — kept for audit
 * but never wins matching.
 */
export const partnerAttributionEvents = pgTable(
  "partner_attribution_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    partnerId: uuid("partner_id")
      .references(() => partners.id, { onDelete: "cascade" })
      .notNull(),
    /** tracked_link | direct_intro */
    type: text("type").notNull(),
    /** Set when this event originated from a click. */
    cookieId: uuid("cookie_id"),
    prospectEmail: text("prospect_email"),
    prospectName: text("prospect_name"),
    company: text("company"),
    sourceDetail: text("source_detail"),
    /** Anchor for first-attribution-wins. */
    recordedAt: timestamp("recorded_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    /** When the sales proposal went out — used to validate direct_intro events. */
    proposalSentAt: timestamp("proposal_sent_at", { withTimezone: true }),
    /**
     * False when a direct_intro was logged AFTER proposal_sent_at, or
     * when admin invalidates the event for any reason. Matching filters
     * is_valid=true.
     */
    isValid: boolean("is_valid").notNull().default(true),
    notes: text("notes"),

    createdBy: uuid("created_by").references(() => adminUsers.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_attribution_partner").on(table.partnerId),
    index("idx_attribution_email").on(table.prospectEmail),
    index("idx_attribution_recorded_at").on(table.recordedAt),
    index("idx_attribution_type").on(table.type),
  ],
);

/**
 * Central commission ledger. Idempotency at the DB level:
 * unique on (source, external_order_id) so concurrent Stripe webhook
 * deliveries can't double-insert (ON CONFLICT DO NOTHING).
 *
 * Clawbacks are represented as NEW rows with negative commission_cents
 * pointing back at the original via clawback_of_conversion_id. The
 * original is flipped to status='reversed'. The next payout batch sums
 * all earned rows including the negatives — net behavior is automatic.
 */
export const partnerConversions = pgTable(
  "partner_conversions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** Nullable until matched — unmatched conversions sit in the admin review queue. */
    partnerId: uuid("partner_id").references(() => partners.id),
    attributionEventId: uuid("attribution_event_id").references(
      () => partnerAttributionEvents.id,
    ),
    buyerEmail: text("buyer_email").notNull(),
    programId: uuid("program_id")
      .references(() => partnerPrograms.id)
      .notNull(),

    grossCents: integer("gross_cents").notNull(),
    /** Tax + processing fees collected separately. */
    feesCents: integer("fees_cents").notNull().default(0),
    /** Setup fees, expansion add-ons, etc. flagged non-commissionable per Terms §3.3. */
    nonCommissionableCents: integer("non_commissionable_cents")
      .notNull()
      .default(0),
    /** gross − fees − non_commissionable. Stored for query simplicity; recomputed on edit. */
    commissionableCents: integer("commissionable_cents").notNull(),
    /** May be NEGATIVE for clawback rows. */
    commissionCents: integer("commission_cents").notNull(),
    currency: text("currency").notNull().default("USD"),

    externalOrderId: text("external_order_id"),
    stripeSessionId: text("stripe_session_id"),
    stripeChargeId: text("stripe_charge_id"),
    /** stripe | manual | clawback */
    source: text("source").notNull(),

    purchasedAt: timestamp("purchased_at", { withTimezone: true }).notNull(),

    /** Set at insert time based on customers_index + prior conversions lookup. */
    isNewCustomer: boolean("is_new_customer").notNull(),
    /** pending | earned | paid | reversed | rejected */
    status: text("status").notNull().default("pending"),
    refundWindowEndsAt: timestamp("refund_window_ends_at", {
      withTimezone: true,
    }).notNull(),
    /** purchased_at + 14d, per Terms §5.4. */
    disputeWindowEndsAt: timestamp("dispute_window_ends_at", {
      withTimezone: true,
    }).notNull(),
    earnedAt: timestamp("earned_at", { withTimezone: true }),
    payoutBatchId: uuid("payout_batch_id"),

    /** Internal note — surfaced to staff in the admin UI only. */
    rejectReason: text("reject_reason"),
    /** Partner-visible reason — surfaced in disputes. Set explicitly by admin on rejection. */
    publicRejectReason: text("public_reject_reason"),

    /** Set on clawback rows; FK to the original conversion that's being reversed. */
    clawbackOfConversionId: uuid("clawback_of_conversion_id"),
    /** Seeded sample conversion — excluded from admin stat tiles. */
    isSample: boolean("is_sample").notNull().default(false),

    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("uniq_partner_conversions_source_order")
      .on(table.source, table.externalOrderId)
      .where(sql`external_order_id IS NOT NULL`),
    index("idx_partner_conversions_status").on(table.status),
    index("idx_partner_conversions_partner").on(table.partnerId),
    index("idx_partner_conversions_buyer_email").on(table.buyerEmail),
    index("idx_partner_conversions_refund_ends").on(table.refundWindowEndsAt),
    index("idx_partner_conversions_payout_batch").on(table.payoutBatchId),
    // UNIQUE (partial): at most one clawback per original conversion. The
    // DB enforces it even if application logic regresses — a second
    // concurrent clawback insert raises a violation instead of silently
    // double-paying. Normal rows (NULL clawback_of) are excluded.
    uniqueIndex("uniq_partner_conversions_clawback_of")
      .on(table.clawbackOfConversionId)
      .where(sql`clawback_of_conversion_id IS NOT NULL`),
  ],
);

/**
 * Append-only audit log of conversion lifecycle. Mirrors the campaign_events
 * pattern. Every status transition writes a row. We do NOT extend the
 * existing audit_logs.auditActionEnum because that would force every
 * partner event onto the same noisy table the onboarding flow uses.
 */
export const partnerConversionEvents = pgTable(
  "partner_conversion_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    conversionId: uuid("conversion_id")
      .references(() => partnerConversions.id, { onDelete: "cascade" })
      .notNull(),
    /** e.g. status_changed | clawback_initiated | dispute_opened | manually_matched */
    eventType: text("event_type").notNull(),
    fromStatus: text("from_status"),
    toStatus: text("to_status"),
    actorId: uuid("actor_id").references(() => adminUsers.id),
    actorEmail: text("actor_email"),
    details: jsonb("details").default({}),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_partner_conv_events_conversion").on(table.conversionId),
    index("idx_partner_conv_events_occurred_at").on(table.occurredAt),
    index("idx_partner_conv_events_type").on(table.eventType),
  ],
);

/**
 * The new-customer gate (Terms §3.2) source of truth. Seeded by a
 * one-time CSV import of every prior CAIO buyer (GHL + Circle + Stripe).
 * Live conversions then keep extending it via ingestConversion's
 * ON CONFLICT (email) DO NOTHING upsert — first_purchase_at is never
 * clobbered by re-imports.
 */
export const customersIndex = pgTable(
  "customers_index",
  {
    email: text("email").primaryKey(),
    firstPurchaseAt: timestamp("first_purchase_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    /** ghl | circle | stripe | manual */
    source: text("source"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
);

export const partnerPayoutBatches = pgTable(
  "partner_payout_batches",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** YYYYMM, e.g. 202607. */
    periodYyyymm: integer("period_yyyymm").notNull(),
    generatedAt: timestamp("generated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    /** draft | exported | paid */
    status: text("status").notNull().default("draft"),
    totalCents: integer("total_cents").notNull().default(0),
    /** Optional URL to the exported CSV (e.g. Vercel Blob) once finance has it. */
    exportUrl: text("export_url"),
    generatedBy: uuid("generated_by").references(() => adminUsers.id),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    paidBy: uuid("paid_by").references(() => adminUsers.id),
  },
  (table) => [
    index("idx_partner_payout_period").on(table.periodYyyymm),
    index("idx_partner_payout_status").on(table.status),
  ],
);

export const partnerDisputes = pgTable(
  "partner_disputes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    partnerId: uuid("partner_id")
      .references(() => partners.id, { onDelete: "cascade" })
      .notNull(),
    /** Nullable — partner may file before we've located a matching conversion. */
    conversionId: uuid("conversion_id").references(() => partnerConversions.id),
    submittedAt: timestamp("submitted_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    dealCloseDate: timestamp("deal_close_date", { withTimezone: true }),
    evidence: text("evidence"),
    /** open | upheld | denied | closed */
    status: text("status").notNull().default("open"),
    resolution: text("resolution"),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    decidedBy: uuid("decided_by").references(() => adminUsers.id),
    /** Seeded sample dispute — badged "SAMPLE ONLY" and excluded from counts. */
    isSample: boolean("is_sample").notNull().default(false),
  },
  (table) => [
    index("idx_partner_disputes_partner").on(table.partnerId),
    index("idx_partner_disputes_status").on(table.status),
  ],
);

/**
 * Editable email-template overrides. Defaults live in code (the email registry);
 * a row here overrides the subject / heading / body for a given template key.
 * Header + footer chrome is NOT editable.
 */
export const partnerEmailTemplates = pgTable("partner_email_templates", {
  key: text("key").primaryKey(),
  subject: text("subject"),
  heading: text("heading"),
  bodyHtml: text("body_html"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedBy: uuid("updated_by"),
});

// ---- Relations ---------------------------------------------------------

export const partnersRelations = relations(partners, ({ many, one }) => ({
  attributionEvents: many(partnerAttributionEvents),
  conversions: many(partnerConversions),
  disputes: many(partnerDisputes),
  clicks: many(partnerClicks),
  approver: one(adminUsers, {
    fields: [partners.approvedBy],
    references: [adminUsers.id],
  }),
}));

export const partnerSettingsRelations = relations(
  partnerSettings,
  ({ one }) => ({
    creator: one(adminUsers, {
      fields: [partnerSettings.createdBy],
      references: [adminUsers.id],
    }),
  }),
);

export const partnerProgramsRelations = relations(
  partnerPrograms,
  ({ many }) => ({
    conversions: many(partnerConversions),
  }),
);

export const partnerClicksRelations = relations(partnerClicks, ({ one }) => ({
  partner: one(partners, {
    fields: [partnerClicks.partnerId],
    references: [partners.id],
  }),
}));

export const partnerAttributionEventsRelations = relations(
  partnerAttributionEvents,
  ({ one }) => ({
    partner: one(partners, {
      fields: [partnerAttributionEvents.partnerId],
      references: [partners.id],
    }),
    creator: one(adminUsers, {
      fields: [partnerAttributionEvents.createdBy],
      references: [adminUsers.id],
    }),
  }),
);

export const partnerConversionsRelations = relations(
  partnerConversions,
  ({ one, many }) => ({
    partner: one(partners, {
      fields: [partnerConversions.partnerId],
      references: [partners.id],
    }),
    program: one(partnerPrograms, {
      fields: [partnerConversions.programId],
      references: [partnerPrograms.id],
    }),
    attributionEvent: one(partnerAttributionEvents, {
      fields: [partnerConversions.attributionEventId],
      references: [partnerAttributionEvents.id],
    }),
    payoutBatch: one(partnerPayoutBatches, {
      fields: [partnerConversions.payoutBatchId],
      references: [partnerPayoutBatches.id],
    }),
    events: many(partnerConversionEvents),
  }),
);

export const partnerConversionEventsRelations = relations(
  partnerConversionEvents,
  ({ one }) => ({
    conversion: one(partnerConversions, {
      fields: [partnerConversionEvents.conversionId],
      references: [partnerConversions.id],
    }),
    actor: one(adminUsers, {
      fields: [partnerConversionEvents.actorId],
      references: [adminUsers.id],
    }),
  }),
);

export const partnerPayoutBatchesRelations = relations(
  partnerPayoutBatches,
  ({ many, one }) => ({
    conversions: many(partnerConversions),
    generator: one(adminUsers, {
      fields: [partnerPayoutBatches.generatedBy],
      references: [adminUsers.id],
    }),
  }),
);

export const partnerDisputesRelations = relations(
  partnerDisputes,
  ({ one }) => ({
    partner: one(partners, {
      fields: [partnerDisputes.partnerId],
      references: [partners.id],
    }),
    conversion: one(partnerConversions, {
      fields: [partnerDisputes.conversionId],
      references: [partnerConversions.id],
    }),
    decider: one(adminUsers, {
      fields: [partnerDisputes.decidedBy],
      references: [adminUsers.id],
    }),
  }),
);

// ========================================================================
// Partner Program — marketing resources (affiliate-facing assets)
// ========================================================================
// The Playbook, Marketing Toolkit, brand assets, email templates, social
// posts, banners — anything staff want to make available to affiliates.
// Either an uploaded file (Vercel Blob → fileUrl) or a linked external
// asset (externalUrl). Public resources show on the affiliate-facing
// /partners/resources page.
// ========================================================================

export const partnerResources = pgTable(
  "partner_resources",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    title: text("title").notNull(),
    description: text("description"),
    /** playbook | toolkit | brand_asset | email_template | social_post | banner | other */
    category: text("category").notNull().default("other"),
    /** Uploaded-file URL (Vercel Blob). Null when this is a linked asset. */
    fileUrl: text("file_url"),
    /** External link (Google Drive, Canva, etc.). Null when this is an upload. */
    externalUrl: text("external_url"),
    fileName: text("file_name"),
    mimeType: text("mime_type"),
    sizeBytes: integer("size_bytes"),
    /** Visible on the public affiliate resources page when true. */
    isPublic: boolean("is_public").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),

    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdBy: uuid("created_by").references(() => adminUsers.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_partner_resources_category").on(table.category),
    index("idx_partner_resources_public").on(table.isPublic),
    index("idx_partner_resources_archived").on(table.archivedAt),
  ],
);
