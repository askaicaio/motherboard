# Motherboard — Central Automations Tracking — Build Brief

You're building a new **Automations** tab in Motherboard (CAIO's internal operations
dashboard). It gives the team one place to see every automation running across our
stack — health, last run, errors — instead of logging into four different tools.

This doc has everything: machine setup → learning the codebase → the feature spec →
how we work. Read it top to bottom once before you start.

---

## Part 0 — What you're walking into

**Motherboard** is a Next.js 16 + TypeScript + Tailwind v4 app, Drizzle ORM on a
Supabase Postgres database, deployed on Vercel. Auth is Google OAuth locked to
`@chiefaiofficer.com`. It's already in production at
`https://motherboard.chiefaiofficer.com`.

There is an existing feature called **Campaigns** that is almost exactly the shape of
what you're building (a registry that syncs from GoHighLevel on a cron, plus a
dashboard UI). **Copy its patterns.** More on that in Part 2.

---

## Part 1 — Set up your machine

### 1.1 Install Node.js (prerequisite)
You need Node.js 20 or newer. Check with `node -v`. If you don't have it, install the
LTS from https://nodejs.org.

### 1.2 Install Claude Code
Pick the line for your OS and run it in a terminal:

- **macOS / Linux:** `curl -fsSL https://claude.ai/install.sh | bash`
- **Windows (PowerShell):** `irm https://claude.ai/install.ps1 | iex`
- **Any OS (via npm):** `npm install -g @anthropic-ai/claude-code`

Verify: `claude --version`

### 1.3 Sign in
1. In a terminal, run: `claude`
2. At the prompt type: `/login`
3. A browser opens — sign in with **operations@chiefaiofficer.com**.
   - ⚠️ That account must have an active **Claude Pro, Max, or Team** subscription for
     Claude Code to work. If login says "no subscription," tell Cedric — he'll either
     enable it on that account or provide an Anthropic API key instead.
4. Back in the terminal you should see your account name. You're in.

### 1.4 Get access to the code
- Cedric will add **operations@chiefaiofficer.com** (or your GitHub username) as a
  collaborator on the repo `askaicaio/motherboard`. You can't clone it until he does.
- Once added, clone it:
  ```bash
  git clone https://github.com/askaicaio/motherboard.git
  cd motherboard
  ```

### 1.5 Install dependencies
```bash
npm install
```

### 1.6 Environment variables
1. Copy the template:
   ```bash
   cp .env.local.example .env.local
   ```
2. You need the real values for at least `DATABASE_URL`, `NEXTAUTH_SECRET`,
   `NEXTAUTH_URL` (`http://localhost:3000` for local), `GOOGLE_CLIENT_ID`,
   `GOOGLE_CLIENT_SECRET`, `ALLOWED_EMAIL_DOMAIN`.
   - **Cedric will send these via 1Password — NOT via Discord.** Never paste secrets
     into chat. The repo uses 1Password already (`OP_SERVICE_ACCOUNT_TOKEN`).
3. For this feature you'll also eventually need the automation-source credentials
   (see Part 3): GHL tokens for both subaccounts, a Make API token, an n8n API key.
   Get those from Cedric the same way when you reach that phase.

### 1.7 Run it locally
```bash
npm run dev
```
Open http://localhost:3000. If `NEXTAUTH_SECRET` is unset locally, the app falls back
to a mock admin user so you can develop UI without real Google login — but for testing
the real flows you'll want the actual env values.

### 1.8 Sanity check before you build
- `npm run build` should succeed.
- `npx tsc --noEmit` should be clean.
- `npx eslint <files you touched>` should be clean.
Run all three before every commit. CI/Vercel will reject a broken build.

---

## Part 2 — Learn the codebase

### 2.1 Read this first — IMPORTANT
The repo's `AGENTS.md` says: **"This is NOT the Next.js you know."** This project pins
a Next.js version with breaking changes vs. older docs. Before writing framework code,
read the relevant guide under `node_modules/next/dist/docs/`. Claude Code will do this
for you if you ask it to — tell it "read the Next.js docs in node_modules before
writing routing/server-component code." Don't trust your memory of older Next.js.

### 2.2 The stack, concretely
- **Routing:** App Router. Server components by default; `"use client"` only when you
  need interactivity. Pages live in `src/app/(dashboard)/<name>/page.tsx`.
- **API:** Route handlers in `src/app/api/<name>/route.ts` (export `GET`, `POST`, etc).
- **DB:** Drizzle ORM. Schema is one big file: `src/lib/db/schema.ts`. The client is
  `src/lib/db/index.ts` (import `db` from `@/lib/db`).
- **Auth guard:** `requireAuth()` / `getOptionalAuth()` from `src/lib/auth/guard.ts`.
- **UI:** Tailwind v4 + a local component library in `src/components/ui/`
  (Button, Card, Dialog, Table, DropdownMenu, Badge, Input, etc). Use these — don't
  bring in a new component kit. Note: the dropdown/dialog primitives are Base UI, so
  `DropdownMenuTrigger` does **not** accept `asChild` — nest the trigger content
  directly.
- **Toasts:** `import { toast } from "sonner"`.
- **Icons:** `lucide-react`. (Heads up: some brand icons like `Slack`/`Github` aren't
  exported in this version — use generic ones like `MessageSquare`/`Code2`.)

### 2.3 Your reference feature: Campaigns
This is the template. Study these files — your Automations feature mirrors them
almost 1:1:

| Concern | Campaigns file to copy from |
|---|---|
| DB tables + relations | `src/lib/db/schema.ts` (search `campaigns`, `campaignLeads`, `campaignEvents`) |
| List page (server) | `src/app/(dashboard)/campaigns/page.tsx` |
| List UI (client) | `src/components/campaigns/campaigns-page-client.tsx` |
| Detail page + metrics + tabs | `src/app/(dashboard)/campaigns/[id]/page.tsx` + `campaign-detail-client.tsx` |
| CRUD API | `src/app/api/campaigns/route.ts` + `src/app/api/campaigns/[id]/route.ts` |
| **GHL polling client** | `src/lib/integrations/ghl-client.ts` |
| **Cron that polls GHL every 5 min** | `src/app/api/cron/sync-ghl-campaigns/route.ts` |
| Cron registration | `vercel.json` → `crons` array |
| **n8n client** | `src/lib/n8n/client.ts` |
| Sidebar entry | `src/components/layout/sidebar.tsx` |

The most recently added tab, **Docs** (`src/components/docs/`,
`src/app/(dashboard)/docs/`), is a simpler reference for the list/grid/CRUD UI pattern
if Campaigns feels like too much at once.

---

## Part 3 — The feature: Central Automations Tracking

### 3.1 Goal
One dashboard showing every automation across our four platforms, so the team can
answer at a glance:
- What automations exist, and where do they live?
- Which ones are active vs paused?
- Which ones errored recently, and what was the error?
- When did each last run?

### 3.2 The four sources (and how each behaves)
This is the crux — the platforms differ a lot in what their APIs allow.

| Platform | What we track | API reality |
|---|---|---|
| **GHL** (2 subaccounts) | Workflows: name, status, per subaccount | GHL API v2 has a workflows endpoint per `locationId`. Each subaccount = its own `locationId` + Private Integration Token. Run-history via API is **limited** — you can list workflows and status, but detailed per-execution logs aren't well exposed. We already have a working GHL client + cron to extend. |
| **Make** (Integromat) | Scenarios: name, active/inactive, recent executions | Make REST API is good: `GET /scenarios` lists them, `GET /scenarios/{id}/logs` gives execution history. Needs an API token + the region base URL (e.g. `eu1.make.com` or `us1.make.com`). |
| **n8n** | Workflows + executions | n8n REST API is good: `GET /workflows` and `GET /executions`. Auth via `X-N8N-API-KEY` header. We already have `N8N_BASE_URL` configured. |
| **Zapier** | Zaps + error events | ⚠️ Zapier has **no public API to list a user's Zaps + run history**. Plan for: (a) **manual inventory** entries, and (b) a **"Zapier Manager" error trigger** (built-in Zapier app) that fires a webhook to Motherboard whenever any Zap errors. Don't burn time hunting for a list API — it doesn't exist for our plan. |

### 3.3 Suggested data model
Mirror the Campaigns shape (`campaigns → leads → events` becomes
`connections → automations → runs`). Add to `src/lib/db/schema.ts`:

**`automation_connections`** — one row per platform integration
- `id`, `platform` (`'ghl' | 'make' | 'zapier' | 'n8n'`), `label` (e.g. "GHL — Main",
  "GHL — Sub 2", "Make — CAIO"), `base_url` (Make region / n8n host), `external_account_id`
  (GHL locationId), `credential_env_key` (name of the env var holding the token — keep
  **secrets in env vars, not the DB**), `is_active`, `last_synced_at`, `sync_status`,
  `sync_error`, timestamps.

**`automations`** — the inventory (one row per workflow / scenario / zap)
- `id`, `connection_id` (FK), `platform`, `external_id` (the id on the platform),
  `name`, `status` (`'active' | 'paused' | 'errored' | 'unknown'`), `description`,
  `folder`, `external_url` (deep link to edit it on the platform), `owner`,
  `last_run_at`, `last_run_status`, `total_runs`, `error_count`, `tags` (text[]),
  `archived_at`, timestamps. Unique index on `(connection_id, external_id)` so re-syncs
  upsert instead of duplicating.

**`automation_runs`** — execution events (for health + history timeline)
- `id`, `automation_id` (FK), `connection_id`, `status` (`'success' | 'error' | 'warning'`),
  `started_at`, `finished_at`, `duration_ms`, `error_message`, `raw_payload` (jsonb),
  `created_at`.

> ⚠️ **You cannot run migrations against production yourself.** Motherboard's prod DB
> lives in a Supabase project that only Cedric can reach. Workflow: you write an
> **idempotent** SQL migration file under `supabase/migrations/NNNN_*.sql` (use
> `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`), and Cedric pastes it into
> the Supabase SQL Editor. Keep the Drizzle schema and the SQL file in sync. Look at
> existing files in `supabase/migrations/` for the exact style.

### 3.4 Sync strategy per platform
- **n8n + Make** (best APIs): build a poller for each. Add to the cron (or a new cron
  route). Upsert into `automations`, insert recent `automation_runs`. Model it on
  `src/app/api/cron/sync-ghl-campaigns/route.ts` and register the schedule in
  `vercel.json` `crons`.
- **GHL** (2 subaccounts): extend `src/lib/integrations/ghl-client.ts` with a
  `listWorkflows(locationId)` call. Loop both subaccounts. Status only; runs may be
  unavailable — that's fine, leave run history empty for GHL in v1.
- **Zapier:** a webhook ingest route, `POST /api/automations/webhook/[secret]`, that a
  Zapier "Manager" error-trigger Zap calls on failures → records an `automation_runs`
  row with `status: 'error'`. Inventory is manual (an "Add automation" dialog). Model
  the webhook on `src/app/api/campaigns/[id]/webhook/[secret]/route.ts` (it already
  handles tolerant payload parsing + secret auth).

### 3.5 UI (mirror Campaigns + Docs)
- **`/automations` list page** with a health header: total / active / errored / runs
  today / error rate. Group by platform (or by subaccount). Filters: platform, status,
  search. Each card: name, platform icon, status badge, last-run time, error count, and
  a deep link to open it on the source platform.
- **`/automations/[id]` detail page**: run-history timeline (copy the lead-journey
  timeline in `src/components/campaigns/lead-journey-dialog.tsx`), error messages,
  metadata.
- **Sidebar:** add an "Automations" entry in `src/components/layout/sidebar.tsx`
  (use the `Workflow` or `Zap` lucide icon).

### 3.6 Suggested phasing (ship value early)
1. **Phase 1 — Schema + manual inventory + UI.** Tables, the `/automations` page, an
   "Add automation" dialog. The team can hand-enter automations day one. Plus the
   Zapier error webhook.
2. **Phase 2 — n8n sync.** Best API, easiest win. Cron poller → live inventory + runs.
3. **Phase 3 — Make sync.** Same pattern, region base URL.
4. **Phase 4 — GHL workflow sync** for both subaccounts (status only).
Each phase is its own PR.

---

## Part 4 — How we work

- **Never push straight to `main`.** Create a feature branch
  (`git checkout -b feat/automations-phase-1`), commit, push, and open a **Pull
  Request**. `main` auto-deploys to production, so PRs are the safety gate. Tag Cedric
  for review.
- **Quality gates before every commit:** `npx tsc --noEmit`, `npx eslint <files>`, and
  `npm run build` must all pass.
- **Migrations:** idempotent SQL file in `supabase/migrations/`, and tell Cedric to run
  it. He applies it; you don't have prod DB access.
- **Secrets:** env vars only, shared via 1Password, never in code or Discord.
- **Commit style:** look at `git log` — short imperative subject, a body explaining the
  "why." Keep PRs scoped to one phase.
- **When in doubt, copy Campaigns.** It's the closest working example of everything
  this feature needs.

Questions → ping Cedric on Discord. Welcome aboard.
