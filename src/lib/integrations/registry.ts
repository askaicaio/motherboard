// =============================================================
// Integration Registry — Connection Configuration for All Apps
// =============================================================
// Defines what each integration needs to connect, what it can
// automate, and what requires manual action. Used by the
// Integrations page to render connection UI.
// =============================================================

export interface IntegrationDefinition {
  key: string;
  name: string;
  description: string;
  icon: string; // Lucide icon name
  category: "workspace" | "communication" | "project" | "crm" | "security" | "meetings" | "community";
  /**
   * Connection scope — always "workspace".
   * Credentials are set once at the server level and shared by all dashboard admins.
   * There is no per-user OAuth flow; a single service account / API key serves the org.
   */
  connectionScope: "workspace";
  /** What env vars are needed to activate this integration */
  requiredEnvVars: string[];
  /** What can be fully automated via API */
  automatable: string[];
  /** What may need admin/plan constraints */
  planConstraints: string[];
  /** Fallback manual workflow when automation fails */
  manualFallback: string;
  /** Recommended automation approach */
  automationApproach: string;
  /** Setup documentation URL */
  docsUrl?: string;
  /** Whether this integration supports n8n webhook orchestration */
  supportsN8n: boolean;
  /** Whether a direct API connection is supported from this dashboard */
  supportsDirectApi: boolean;
}

export const INTEGRATIONS: IntegrationDefinition[] = [
  {
    key: "google_workspace",
    name: "Google Workspace",
    description: "Create work emails, add to Google Groups, and manage org units",
    icon: "Mail",
    category: "workspace",
    connectionScope: "workspace",
    requiredEnvVars: [
      "GOOGLE_WORKSPACE_CUSTOMER_ID",
      "GOOGLE_SERVICE_ACCOUNT_JSON",
      "GOOGLE_DELEGATED_ADMIN_EMAIL",
    ],
    automatable: [
      "Create user accounts via Admin SDK",
      "Set user passwords and force reset",
      "Add users to Google Groups",
      "Assign to organizational units",
      "Set license type (Business Starter/Standard/Plus)",
    ],
    planConstraints: [
      "Requires Google Workspace Business or Enterprise plan",
      "Service account needs domain-wide delegation",
      "Admin SDK must be enabled in Google Cloud Console",
      "Delegated admin email must have Super Admin or User Management Admin role",
    ],
    manualFallback: "Add user manually via admin.google.com > Users > Add new user",
    automationApproach: "n8n workflow calls Google Admin SDK via service account with domain-wide delegation. Webhook triggers on form submission, creates user, adds to groups, and calls back.",
    docsUrl: "https://developers.google.com/admin-sdk/directory/v1/guides/manage-users",
    supportsN8n: true,
    supportsDirectApi: false,
  },
  {
    key: "slack",
    name: "Slack",
    description: "Invite to workspace, add to channels, and send welcome messages",
    icon: "MessageSquare",
    category: "communication",
    connectionScope: "workspace",
    requiredEnvVars: [
      "SLACK_BOT_TOKEN",
      "SLACK_WORKSPACE_ID",
    ],
    automatable: [
      "Invite users to workspace via SCIM or admin.users.invite",
      "Add users to public/private channels",
      "Set user profile fields",
      "Send welcome DM or channel messages",
    ],
    planConstraints: [
      "SCIM provisioning requires Slack Business+ or Enterprise Grid",
      "admin.users.invite requires Slack admin API scope (Enterprise Grid only)",
      "On free/Pro plans, can only send invite emails via admin.inviteRequests.approve",
      "Bot must be added to private channels before it can invite users",
    ],
    manualFallback: "Send Slack invite from workspace settings > Invite people, then manually add to channels",
    automationApproach: "Bot Token with users:write, channels:manage, chat:write scopes. n8n sends invite, waits for user to accept, then adds to channels and sends welcome DM.",
    docsUrl: "https://api.slack.com/methods/admin.users.invite",
    supportsN8n: true,
    supportsDirectApi: true,
  },
  {
    key: "clickup",
    name: "ClickUp",
    description: "Invite to workspace, assign to spaces and folders",
    icon: "CheckSquare",
    category: "project",
    connectionScope: "workspace",
    requiredEnvVars: [
      "CLICKUP_API_KEY",
      "CLICKUP_WORKSPACE_ID",
    ],
    automatable: [
      "Invite user to workspace via email",
      "Add user to specific Spaces",
      "Set user role (admin, member, guest)",
      "Create onboarding tasks for the new hire",
    ],
    planConstraints: [
      "Guest access is limited on free/Unlimited plans",
      "Custom roles require Business plan or higher",
      "API rate limits: 100 requests per minute per token",
    ],
    manualFallback: "Invite user from ClickUp Settings > People > Invite, then manually add to Spaces",
    automationApproach: "n8n workflow uses ClickUp API v2 with Personal API Token. Invites user, adds to spaces, and optionally creates onboarding task list.",
    docsUrl: "https://clickup.com/api",
    supportsN8n: true,
    supportsDirectApi: true,
  },
  {
    key: "gohighlevel",
    name: "GoHighLevel",
    description: "Add as team member or sub-account user in the CRM",
    icon: "Rocket",
    category: "crm",
    connectionScope: "workspace",
    requiredEnvVars: [
      "GHL_API_KEY",
      "GHL_LOCATION_ID",
    ],
    automatable: [
      "Create user in location/sub-account",
      "Assign user role (admin, user)",
      "Add to specific location(s)",
    ],
    planConstraints: [
      "API access varies by GHL plan (Agency vs SaaS Mode)",
      "Sub-account user creation may require Agency Pro plan",
      "Some role assignments are restricted to account owner",
    ],
    manualFallback: "Add team member via GHL Settings > My Staff > Add Employee, then assign locations and permissions",
    automationApproach: "n8n workflow uses GHL API v2 with Agency or Location API key. Creates user and assigns to locations. Rate limits are strict.",
    docsUrl: "https://highlevel.stoplight.io/docs/integrations",
    supportsN8n: true,
    supportsDirectApi: true,
  },
  {
    key: "circle",
    name: "Circle",
    description: "Invite to community, assign to space groups",
    icon: "Users",
    category: "community",
    connectionScope: "workspace",
    requiredEnvVars: [
      "CIRCLE_API_KEY",
      "CIRCLE_COMMUNITY_ID",
    ],
    automatable: [
      "Invite member to community",
      "Add member to space groups",
      "Set member type (member, moderator, admin)",
    ],
    planConstraints: [
      "API access requires Circle Professional plan or higher",
      "Space group management may need admin-level API token",
      "Rate limit: 120 requests per minute",
    ],
    manualFallback: "Invite from Circle admin > Members > Invite, then manually add to space groups",
    automationApproach: "n8n calls Circle API v1 to invite member and add to space groups. Uses admin API token.",
    docsUrl: "https://api.circle.so",
    supportsN8n: true,
    supportsDirectApi: true,
  },
  {
    key: "onepassword",
    name: "1Password",
    description: "Invite to team, assign to groups and vaults",
    icon: "KeyRound",
    category: "security",
    connectionScope: "workspace",
    requiredEnvVars: [
      "OP_SERVICE_ACCOUNT_TOKEN",
    ],
    automatable: [
      "Invite user to 1Password team",
      "Assign to groups (which grant vault access)",
      "Provision via SCIM if on Business plan",
    ],
    planConstraints: [
      "SCIM provisioning requires 1Password Business plan",
      "Service account tokens cannot manage users directly on Teams plan",
      "User MUST accept invite before vaults become accessible",
      "Cannot automate master password setup — always manual",
    ],
    manualFallback: "Invite from 1Password admin console > People > Invite. After acceptance, add to appropriate groups/vaults.",
    automationApproach: "n8n triggers SCIM provisioning (Business plan) or sends invite via 1Password Events API. Callback marks step as manual_required until user accepts invite.",
    docsUrl: "https://developer.1password.com/docs/scim",
    supportsN8n: true,
    supportsDirectApi: false,
  },
  {
    key: "zoom",
    name: "Zoom",
    description: "Create Zoom account, assign license type",
    icon: "Video",
    category: "meetings",
    connectionScope: "workspace",
    requiredEnvVars: [
      "ZOOM_ACCOUNT_ID",
      "ZOOM_CLIENT_ID",
      "ZOOM_CLIENT_SECRET",
    ],
    automatable: [
      "Create user (custCreate or autoCreate action)",
      "Assign license type (Basic, Licensed, On-Prem)",
      "Add to Zoom groups",
      "Set feature settings (recording, waiting room defaults)",
    ],
    planConstraints: [
      "User creation via API requires Zoom Business or Enterprise plan",
      "Licensed seat assignment is limited by available licenses",
      "SSO auto-provisioning can conflict with API user creation",
      "API uses Server-to-Server OAuth app (requires admin setup)",
    ],
    manualFallback: "Add user via admin.zoom.us > User Management > Add Users. Assign license type manually.",
    automationApproach: "n8n uses Zoom Server-to-Server OAuth app to call /users endpoint. Creates user with custCreate action and assigns license type.",
    docsUrl: "https://developers.zoom.us/docs/api/rest/reference/user/methods/#operation/userCreate",
    supportsN8n: true,
    supportsDirectApi: true,
  },
  {
    key: "fathom",
    name: "Fathom",
    description: "Shared team account — accessed via Google SSO with 1Password credentials",
    icon: "FileText",
    category: "meetings",
    connectionScope: "workspace",
    requiredEnvVars: [],
    automatable: [],
    planConstraints: [
      "Fathom does not have a user provisioning API",
      "Access is via shared Google account (teams@chiefaiofficer.com)",
      "Credentials stored in 1Password Moderators vault",
    ],
    manualFallback: "Ensure user has 1Password access to the Moderators vault. Provide Fathom login instructions in onboarding email.",
    automationApproach: "No API automation possible. Fathom access is instruction-only: the onboarding email includes steps to sign in via Google using shared credentials from the 1Password Moderators vault.",
    supportsN8n: false,
    supportsDirectApi: false,
  },
];

export function getIntegration(key: string): IntegrationDefinition | undefined {
  return INTEGRATIONS.find((i) => i.key === key);
}

export function getIntegrationsByCategory(
  category: IntegrationDefinition["category"]
): IntegrationDefinition[] {
  return INTEGRATIONS.filter((i) => i.category === category);
}
