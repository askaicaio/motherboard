# Integration Guide — Provisioning Providers

Each external tool has different API capabilities, plan restrictions, and automation
limits. This guide documents the recommended approach for each.

---

## Google Workspace

**Recommended automation:** Full via Google Admin SDK (Directory API)

**What can be automated:**
- Create user account (`POST /admin/directory/v1/users`)
- Set license type (Business Starter, Standard, Plus)
- Add to Google Groups
- Set Organizational Unit (OU)
- Send password reset link
- Suspend/unsuspend accounts (for offboarding)

**Plan/admin constraints:**
- Requires a Google Workspace admin account with Directory API access
- Must create a Service Account with domain-wide delegation
- Scopes needed: `https://www.googleapis.com/auth/admin.directory.user`,
  `https://www.googleapis.com/auth/admin.directory.group`
- Super Admin or User Management Admin role required

**Fallback manual workflow:**
1. Log into admin.google.com
2. Users → Add new user
3. Set name, email, org unit
4. Add to groups manually
5. Send login instructions

**n8n workflow design:**
- Trigger: webhook from dashboard
- Node 1: Google Admin — Create User
- Node 2: Google Admin — Add to Groups (loop)
- Node 3: Google Admin — Assign License
- Node 4: HTTP Request — callback to dashboard

---

## Slack

**Recommended automation:** Full via Slack SCIM API or Admin API

**What can be automated:**
- Invite user to workspace (`POST /api/admin.users.invite` or SCIM)
- Add to channels (`POST /api/conversations.invite`)
- Set user profile fields
- Deactivate user (offboarding)

**Plan/admin constraints:**
- SCIM API requires Slack Business+ or Enterprise Grid plan
- `admin.users.invite` requires Enterprise Grid or Business+ with Admin API
- On free/Pro plans, only manual invite or Slack Connect is available
- Bot tokens need: `admin.users:write`, `channels:manage`, `users:read`

**Fallback manual workflow:**
1. Go to Slack workspace settings → Invite people
2. Enter user's email address
3. Manually add to channels after they accept

**n8n workflow design:**
- Trigger: webhook
- Node 1: Slack — Send Invite (SCIM or admin.users.invite)
- Node 2: Wait for user activation (optional polling)
- Node 3: Slack — Add to Channels (loop)
- Node 4: Callback to dashboard

---

## ClickUp

**Recommended automation:** Partial via ClickUp API v2

**What can be automated:**
- Invite user to workspace (`POST /api/v2/team/{team_id}/user`)
- Add to Spaces
- Set custom role (if on Enterprise plan)

**Plan/admin constraints:**
- Custom roles require ClickUp Enterprise
- API rate limits: 100 requests/minute on most plans
- Workspace owner or admin API token required
- Some permission levels only configurable via UI

**Fallback manual workflow:**
1. Go to ClickUp → Settings → People
2. Click "Invite" and enter email
3. Set role (Admin, Member, Guest)
4. Add to specific Spaces/Folders

**n8n workflow design:**
- Trigger: webhook
- Node 1: HTTP Request — Invite user to team
- Node 2: HTTP Request — Add to spaces (loop)
- Node 3: Callback to dashboard

---

## GoHighLevel (GHL)

**Recommended automation:** Partial via GHL API v2

**What can be automated:**
- Create/invite sub-account user
- Assign user role
- Add to specific locations
- Set permissions

**Plan/admin constraints:**
- API access varies significantly by GHL plan (Agency vs. SaaS Mode)
- User creation may require Agency-level access
- Some role assignments only available via UI
- API documentation can be inconsistent — test thoroughly
- OAuth tokens expire and need refresh handling

**Fallback manual workflow:**
1. Log into GHL Agency dashboard
2. Navigate to sub-account → Settings → My Staff
3. Add team member with email
4. Assign role and location access
5. User receives invite email

**n8n workflow design:**
- Trigger: webhook
- Node 1: GHL — Create User (via API or custom HTTP)
- Node 2: GHL — Assign Role/Location
- Node 3: Callback to dashboard
- NOTE: May need to use Make/Zapier for GHL if n8n connector is limited

---

## Circle

**Recommended automation:** Partial via Circle API v1

**What can be automated:**
- Invite member to community
- Add to Space Groups
- Set member role (admin, moderator, member)

**Plan/admin constraints:**
- API access requires Circle Professional or Business plan
- Rate limits apply (check current Circle API docs)
- Some community settings only configurable via Circle admin UI
- Space Group management may have API limitations

**Fallback manual workflow:**
1. Log into Circle admin
2. Members → Invite
3. Enter email and select Space Groups
4. Set role level
5. User receives invitation email

**n8n workflow design:**
- Trigger: webhook
- Node 1: HTTP Request — Invite member (POST /community_members)
- Node 2: HTTP Request — Add to space groups (loop)
- Node 3: Callback to dashboard

---

## 1Password

**Recommended automation:** Partial via 1Password SCIM bridge + Events API

**What can be automated:**
- Invite user to team (SCIM provisioning)
- Assign to groups
- Assign to vaults (after user accepts invite)

**Plan/admin constraints:**
- SCIM bridge requires 1Password Business plan
- Vault sharing CANNOT happen until user accepts the invite (critical!)
- Events API is read-only (for audit, not provisioning)
- Direct vault content management requires 1Password CLI or Connect Server
- Some operations require 1Password admin confirmation

**Fallback manual workflow:**
1. Log into 1Password admin (my.1password.com)
2. People → Invite → Enter email
3. Wait for user to accept invite
4. Add user to appropriate vaults/groups
5. Confirm vault access is working

**n8n workflow design:**
- Trigger: webhook
- Node 1: SCIM — Create User (send invite)
- Node 2: Set step to `manual_required` (vault sharing needs invite acceptance)
- Node 3: Callback with `requiresManualAction: true`
- Follow-up: Admin manually adds to vaults after user accepts

---

## Fathom

**Recommended automation:** None (shared account model)

**What can be automated:**
- Nothing — Fathom uses a shared team account (teams@chiefaiofficer.com)

**Plan/admin constraints:**
- Fathom does not have a user management API
- Access is via shared Google account credentials
- Credentials stored in 1Password Moderators vault

**Fallback manual workflow (this IS the workflow):**
1. Ensure user has 1Password access to the Moderators vault
2. User signs into Fathom at fathom.video via Google
3. Uses teams@chiefaiofficer.com credentials from 1Password
4. No account creation needed — it's shared access

**Dashboard behavior:**
- When Fathom is selected, a manual task is auto-created
- The onboarding email includes Fathom access instructions
- No n8n webhook is triggered

---

## Adding New Tools

To add a new provisioning tool:

1. Create a new provider file in `src/lib/providers/`:
   ```typescript
   import type { ProvisioningProvider } from "./types";

   export const newToolProvider: ProvisioningProvider = {
     toolKey: "new_tool",
     displayName: "New Tool",
     icon: "Wrench",
     supportsRetry: true,
     defaultExecutionOrder: 25,
     buildN8nPayload(context) { /* ... */ },
     parseN8nCallback(data) { /* ... */ },
     validateConfig(config) { /* ... */ },
   };
   ```

2. Register it in `src/lib/providers/registry.ts`

3. Add a tool instruction block in `src/lib/email/tool-instructions.ts`

4. Add the tool key to `TOOL_KEYS` in `src/types/index.ts`

5. Create the n8n workflow and set the webhook URL

6. Add provisioning rules for the tool in the dashboard or seed data
