/**
 * Seed script for development — run with: npx tsx src/lib/db/seed.ts
 *
 * Creates sample admin users, access-profile provisioning rules, onboarding
 * requests, settings, and a default email template.
 */
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { nanoid } from "nanoid";

const connectionString = process.env.DATABASE_URL!;
const client = postgres(connectionString);
const db = drizzle(client, { schema });

// ---------------------------------------------------------------------------
// Access-profile definitions (seeded as provisioning rules)
// ---------------------------------------------------------------------------

interface AccessProfile {
  profileName: string;
  description: string;
  tools: string[];
  toolConfigs: Record<string, Record<string, unknown>>;
  defaultSlackChannels: string[];
  defaultGoogleGroups: string[];
}

const ACCESS_PROFILES: AccessProfile[] = [
  {
    profileName: "Moderator",
    description: "Content moderators — Google Workspace, Slack, ClickUp, 1Password, Fathom",
    tools: ["google_workspace", "slack", "clickup", "onepassword", "fathom"],
    toolConfigs: {
      google_workspace: {
        license_type: "business-standard",
        groups: ["moderators@chiefaiofficer.com"],
      },
      slack: { channels: ["#general", "#moderators", "#content-team"] },
      clickup: { permissions: ["member"], spaces: ["Content Operations"] },
      onepassword: { vault_names: ["Moderators", "Shared Tools"] },
    },
    defaultSlackChannels: ["#general", "#moderators", "#content-team"],
    defaultGoogleGroups: ["moderators@chiefaiofficer.com"],
  },
  {
    profileName: "Sales Rep",
    description: "Sales representatives — Google Workspace, Slack, GoHighLevel, ClickUp, 1Password",
    tools: ["google_workspace", "slack", "gohighlevel", "clickup", "onepassword"],
    toolConfigs: {
      google_workspace: {
        license_type: "business-standard",
        groups: ["sales@chiefaiofficer.com"],
      },
      slack: { channels: ["#general", "#sales", "#deals"] },
      gohighlevel: { ghl_role: "user" },
      clickup: { permissions: ["member"], spaces: ["Sales Pipeline"] },
      onepassword: { vault_names: ["Sales Team", "Shared Tools"] },
    },
    defaultSlackChannels: ["#general", "#sales", "#deals"],
    defaultGoogleGroups: ["sales@chiefaiofficer.com"],
  },
  {
    profileName: "Account Manager",
    description:
      "Account managers — Google Workspace, Slack, GoHighLevel, ClickUp, Circle, 1Password",
    tools: ["google_workspace", "slack", "gohighlevel", "clickup", "circle", "onepassword"],
    toolConfigs: {
      google_workspace: {
        license_type: "business-standard",
        groups: ["accounts@chiefaiofficer.com", "client-facing@chiefaiofficer.com"],
      },
      slack: { channels: ["#general", "#accounts", "#client-success"] },
      gohighlevel: { ghl_role: "admin" },
      clickup: { permissions: ["admin"], spaces: ["Client Projects", "Account Management"] },
      circle: { circle_space_groups: ["Team", "Client Success"] },
      onepassword: { vault_names: ["Account Management", "Shared Tools"] },
    },
    defaultSlackChannels: ["#general", "#accounts", "#client-success"],
    defaultGoogleGroups: ["accounts@chiefaiofficer.com", "client-facing@chiefaiofficer.com"],
  },
  {
    profileName: "Executive Assistant",
    description: "Executive assistants — Google Workspace, Slack, ClickUp, 1Password, Fathom",
    tools: ["google_workspace", "slack", "clickup", "onepassword", "fathom"],
    toolConfigs: {
      google_workspace: {
        license_type: "business-standard",
        groups: ["executive@chiefaiofficer.com", "all-staff@chiefaiofficer.com"],
      },
      slack: { channels: ["#general", "#executive", "#ops"] },
      clickup: { permissions: ["admin"], spaces: ["Executive Operations", "Company Wide"] },
      onepassword: { vault_names: ["Executive", "Moderators", "Shared Tools"] },
    },
    defaultSlackChannels: ["#general", "#executive", "#ops"],
    defaultGoogleGroups: ["executive@chiefaiofficer.com", "all-staff@chiefaiofficer.com"],
  },
  {
    profileName: "Community Support",
    description: "Community support — Google Workspace, Slack, Circle, ClickUp, 1Password",
    tools: ["google_workspace", "slack", "circle", "clickup", "onepassword"],
    toolConfigs: {
      google_workspace: {
        license_type: "business-starter",
        groups: ["support@chiefaiofficer.com"],
      },
      slack: { channels: ["#general", "#community", "#support-tickets"] },
      circle: { circle_space_groups: ["Team", "Community Moderators"] },
      clickup: { permissions: ["member"], spaces: ["Support Queue"] },
      onepassword: { vault_names: ["Community", "Shared Tools"] },
    },
    defaultSlackChannels: ["#general", "#community", "#support-tickets"],
    defaultGoogleGroups: ["support@chiefaiofficer.com"],
  },
];

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

async function seed() {
  console.log("Seeding database...");

  // ── Admin users ──────────────────────────────────────────────────────────
  const [admin] = await db
    .insert(schema.adminUsers)
    .values([
      { email: "admin@chiefaiofficer.com", name: "CAIO Admin", role: "super_admin" },
      { email: "ops@chiefaiofficer.com", name: "Operations", role: "admin" },
      { email: "viewer@chiefaiofficer.com", name: "Viewer", role: "viewer" },
    ])
    .onConflictDoNothing()
    .returning();

  console.log("  Created admin users");

  // ── Access profiles table ────────────────────────────────────────────────
  // Seed the access_profiles table with reusable role packs
  const profileValues = ACCESS_PROFILES.map((p) => ({
    name: p.profileName,
    description: p.description,
    tools: p.tools,
    toolConfigs: p.toolConfigs,
    defaultSlackChannels: p.defaultSlackChannels,
    defaultGoogleGroups: p.defaultGoogleGroups,
    isActive: true,
  }));

  await db.insert(schema.accessProfiles).values(profileValues).onConflictDoNothing();
  console.log(`  Created ${profileValues.length} access profiles`);

  // ── Access-profile provisioning rules ────────────────────────────────────
  // Each profile is also stored as provisioning rules (one row per tool)
  // so the rules engine can auto-match by department/role.
  const profileRules = ACCESS_PROFILES.flatMap((profile) =>
    profile.tools.map((toolKey, idx) => ({
      name: `${profile.profileName} — ${toolKey}`,
      description: profile.description,
      matchDepartment: null,
      matchDivision: null as "b2c" | "b2b" | "sales" | null,
      matchJobTitle: `profile:${profile.profileName}`,
      toolKey,
      toolConfig: {
        ...(profile.toolConfigs[toolKey] ?? {}),
        _accessProfile: profile.profileName,
        _defaultSlackChannels: profile.defaultSlackChannels,
        _defaultGoogleGroups: profile.defaultGoogleGroups,
      },
      priority: 100 + idx,
      isActive: true,
    })),
  );

  await db.insert(schema.provisioningRules).values(profileRules).onConflictDoNothing();
  console.log(`  Created ${profileRules.length} access-profile provisioning rules`);

  // ── Department-to-profile mapping rules ──────────────────────────────────
  // These map department/role combos to the right access-profile toolsets.
  const departmentMappingRules = [
    // Sales department -> Sales Rep tools
    ...ACCESS_PROFILES.find((p) => p.profileName === "Sales Rep")!.tools.map((toolKey, idx) => ({
      name: `Sales Dept — ${toolKey}`,
      description: "Auto-provision for Sales department employees",
      matchDepartment: "Sales",
      matchDivision: null as "b2c" | "b2b" | "sales" | null,
      matchJobTitle: null,
      toolKey,
      toolConfig: {
        ...(ACCESS_PROFILES.find((p) => p.profileName === "Sales Rep")!.toolConfigs[toolKey] ?? {}),
        _sourceProfile: "Sales Rep",
      },
      priority: 50 + idx,
      isActive: true,
    })),

    // Marketing department -> Moderator tools (content creation)
    ...ACCESS_PROFILES.find((p) => p.profileName === "Moderator")!.tools.map((toolKey, idx) => ({
      name: `Marketing Dept — ${toolKey}`,
      description: "Auto-provision for Marketing department (Moderator profile)",
      matchDepartment: "Marketing",
      matchDivision: null as "b2c" | "b2b" | "sales" | null,
      matchJobTitle: null,
      toolKey,
      toolConfig: {
        ...(ACCESS_PROFILES.find((p) => p.profileName === "Moderator")!.toolConfigs[toolKey] ?? {}),
        _sourceProfile: "Moderator",
      },
      priority: 50 + idx,
      isActive: true,
    })),

    // Community department -> Community Support tools
    ...ACCESS_PROFILES.find((p) => p.profileName === "Community Support")!.tools.map(
      (toolKey, idx) => ({
        name: `Community Dept — ${toolKey}`,
        description: "Auto-provision for Community department",
        matchDepartment: "Community",
        matchDivision: null as "b2c" | "b2b" | "sales" | null,
        matchJobTitle: null,
        toolKey,
        toolConfig: {
          ...(ACCESS_PROFILES.find((p) => p.profileName === "Community Support")!.toolConfigs[
            toolKey
          ] ?? {}),
          _sourceProfile: "Community Support",
        },
        priority: 50 + idx,
        isActive: true,
      }),
    ),

    // Executive department -> Executive Assistant tools
    ...ACCESS_PROFILES.find((p) => p.profileName === "Executive Assistant")!.tools.map(
      (toolKey, idx) => ({
        name: `Executive Dept — ${toolKey}`,
        description: "Auto-provision for Executive department",
        matchDepartment: "Executive",
        matchDivision: null as "b2c" | "b2b" | "sales" | null,
        matchJobTitle: null,
        toolKey,
        toolConfig: {
          ...(ACCESS_PROFILES.find((p) => p.profileName === "Executive Assistant")!.toolConfigs[
            toolKey
          ] ?? {}),
          _sourceProfile: "Executive Assistant",
        },
        priority: 50 + idx,
        isActive: true,
      }),
    ),

    // Default fallback: any department, any role -> Google Workspace + Slack + 1Password
    {
      name: "Default — google_workspace",
      description: "Fallback: every employee gets Google Workspace",
      matchDepartment: null,
      matchDivision: null as "b2c" | "b2b" | "sales" | null,
      matchJobTitle: null,
      toolKey: "google_workspace",
      toolConfig: {
        license_type: "business-starter",
        groups: ["all-staff@chiefaiofficer.com"],
        _sourceProfile: "Default",
      },
      priority: 0,
      isActive: true,
    },
    {
      name: "Default — slack",
      description: "Fallback: every employee gets Slack",
      matchDepartment: null,
      matchDivision: null as "b2c" | "b2b" | "sales" | null,
      matchJobTitle: null,
      toolKey: "slack",
      toolConfig: {
        channels: ["#general"],
        _sourceProfile: "Default",
      },
      priority: 0,
      isActive: true,
    },
    {
      name: "Default — onepassword",
      description: "Fallback: every employee gets 1Password",
      matchDepartment: null,
      matchDivision: null as "b2c" | "b2b" | "sales" | null,
      matchJobTitle: null,
      toolKey: "onepassword",
      toolConfig: {
        vault_names: ["Shared Tools"],
        _sourceProfile: "Default",
      },
      priority: 0,
      isActive: true,
    },
  ];

  await db.insert(schema.provisioningRules).values(departmentMappingRules).onConflictDoNothing();
  console.log(`  Created ${departmentMappingRules.length} department-mapping provisioning rules`);

  // ── Sample onboarding requests ───────────────────────────────────────────
  const sampleRequests = [
    {
      employeeName: "Alice Johnson",
      preferredName: "Alice",
      employeeEmail: "alice@chiefaiofficer.com",
      personalEmail: "alice.j@gmail.com",
      jobTitle: "Senior Engineer",
      department: "Engineering",
      division: "b2b" as const,
      startDate: "2026-04-14",
      onboardingOwner: "CAIO Admin",
      notes: "Joining the platform team. Needs access to all dev tools.",
      status: "pending_approval" as const,
      requestedTools: ["google_workspace", "slack", "clickup", "onepassword"],
      idempotencyKey: `onb_${nanoid(16)}`,
      createdBy: admin?.id,
    },
    {
      employeeName: "Bob Martinez",
      preferredName: "Bobby",
      employeeEmail: "bob@chiefaiofficer.com",
      jobTitle: "Marketing Manager",
      department: "Marketing",
      division: "b2c" as const,
      startDate: "2026-04-21",
      managerName: "Sarah Chen",
      managerEmail: "sarah@chiefaiofficer.com",
      status: "draft" as const,
      requestedTools: ["google_workspace", "slack", "circle", "onepassword"],
      idempotencyKey: `onb_${nanoid(16)}`,
      createdBy: admin?.id,
    },
    {
      employeeName: "Clara Davis",
      employeeEmail: "clara@chiefaiofficer.com",
      jobTitle: "Sales Representative",
      department: "Sales",
      division: "sales" as const,
      startDate: "2026-04-28",
      status: "approved" as const,
      requestedTools: ["google_workspace", "slack", "gohighlevel", "onepassword"],
      idempotencyKey: `onb_${nanoid(16)}`,
      createdBy: admin?.id,
    },
  ];

  await db.insert(schema.onboardingRequests).values(sampleRequests).onConflictDoNothing();
  console.log("  Created sample onboarding requests");

  // ── Settings ─────────────────────────────────────────────────────────────
  await db
    .insert(schema.appSettings)
    .values([
      { key: "n8n_base_url", value: "https://n8n.example.com" },
      { key: "email_from_address", value: "onboarding@chiefaiofficer.com" },
      { key: "email_from_name", value: "CAIO Onboarding" },
      { key: "default_max_retries", value: 3 },
      { key: "provisioning_timeout_minutes", value: 30 },
      { key: "allowed_email_domain", value: "chiefaiofficer.com" },
    ])
    .onConflictDoNothing();
  console.log("  Created default settings");

  // ── Default email template ───────────────────────────────────────────────
  await db
    .insert(schema.appSettings)
    .values([
      {
        key: "default_email_template",
        value: {
          subject: "Welcome to Chief AI Officer, {{preferredName}}!",
          htmlBody: [
            "<h1>Welcome aboard, {{preferredName}}!</h1>",
            "<p>We're excited to have you join us as <strong>{{jobTitle}}</strong> in the <strong>{{department}}</strong> team.</p>",
            "<p>Your start date is <strong>{{startDate}}</strong>. Below you will find access credentials for the tools we've provisioned for you:</p>",
            "<ul>{{#each tools}}<li><strong>{{this.name}}</strong>: {{this.instructions}}</li>{{/each}}</ul>",
            "<p>If you have any questions, reply to this email or reach out on Slack in <strong>#general</strong>.</p>",
            "<p>— The CAIO Onboarding Team</p>",
          ].join("\n"),
          plainBody: [
            "Welcome aboard, {{preferredName}}!",
            "",
            "We're excited to have you join us as {{jobTitle}} in the {{department}} team.",
            "Your start date is {{startDate}}.",
            "",
            "Provisioned tools:",
            "{{#each tools}}  - {{this.name}}: {{this.instructions}}",
            "{{/each}}",
            "",
            "If you have any questions, reply to this email or reach out on Slack in #general.",
            "",
            "— The CAIO Onboarding Team",
          ].join("\n"),
        },
      },
    ])
    .onConflictDoNothing();
  console.log("  Created default email template");

  console.log("Seed complete!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
