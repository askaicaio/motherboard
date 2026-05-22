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

### 1.2 Get Claude Code
There are two ways to use Claude Code. **The team uses it through the Claude desktop
app — start there; it's the friendliest, especially if the terminal isn't your home.**

**Option A — Claude desktop app (recommended):**
1. Download the Claude app from https://claude.ai/download and install it.
2. Open it and sign in with **operations@chiefaiofficer.com** (this account has Claude
   Pro, which includes Claude Code).
3. Open Claude Code inside the app and point it at a project folder (you'll create that
   folder in step 1.5 — or just ask Claude Code to clone the repo for you; it can run
   the commands itself).

**Option B — terminal CLI (if you prefer the command line):**
- macOS / Linux: `curl -fsSL https://claude.ai/install.sh | bash`
- Windows (PowerShell): `irm https://claude.ai/install.ps1 | iex`
- Then run `claude`, type `/login`, sign in with operations@chiefaiofficer.com.

Either way: **you don't have to memorize terminal commands.** Claude Code runs them for
you. The commands in this doc are things you can literally paste to Claude Code and say
"run these," or ask it to do in plain English ("clone the motherboard repo and install
dependencies").

### 1.3 The CAIO accounts you'll use
You'll be signing into CAIO's own accounts (via **operations@chiefaiofficer.com**) for:
**GitHub** (the repo), **Vercel** (deploys + env vars + logs), **Supabase** (the
database), and **Resend** (transactional email). Because you're using the existing
`operations@` login rather than being added as a new paid seat, there's no extra cost.
This also means you can **self-serve** on env vars and migrations — no waiting on
anyone.

### 1.4 Get the code
You already have repo access through CAIO's GitHub. Clone it:
```bash
git clone https://github.com/askaicaio/motherboard.git
cd motherboard
npm install
```

### 1.5 Environment variables — pull them from Vercel
You have Vercel access, so don't hand-copy secrets. Use the CLI:
```bash
npm i -g vercel              # install the Vercel CLI
vercel login                 # sign in as operations@chiefaiofficer.com
vercel link                  # pick the "caio-motherboard" project when prompted
vercel env pull .env.local --environment=production
```
That writes a real `.env.local` for you. (Pull `production` specifically — the
`development` environment may not have `DATABASE_URL` set.) Set `NEXTAUTH_URL` to
`http://localhost:3000` locally afterward.

For this feature you'll also add new automation-source credentials (GHL tokens for both
subaccounts, a Make API token, an n8n API key) — you'll add those as Vercel env vars
yourself when you reach Part 3.

> Security note: a pulled `.env.local` contains live production secrets. It's already
> gitignored — never commit it, and delete it if you hand the machine off.

### 1.6 (Optional) Run it locally
You don't have to — see "Reviewing your work" in Part 2 for the no-local workflow the
team prefers (Vercel preview deployments). But if you want a fast local loop:
```bash
npm run dev
```
Open http://localhost:3000. If `NEXTAUTH_SECRET` is unset locally, the app falls back
to a mock admin user so you can develop UI without real Google login.

### 1.7 Sanity check before you build
- `npm run build` should succeed.
- `npx tsc --noEmit` should be clean.
- `npx eslint <files you touched>` should be clean.
Run all three before every commit. CI/Vercel will reject a broken build.

---

## Part 2 — Learn the codebase

### 2.0 How to build with Claude Code (read this if you're new to it)
Claude Code is your pair programmer. You describe what you want in plain English; it
reads the code, proposes changes, edits files, and runs commands (git, npm, migrations)
for you. You stay in the loop by reviewing what it does. A few habits make it work well:

- **Start by orienting it.** First message in a fresh session: *"This is the Motherboard
  repo. Read AGENTS.md and the AUTOMATIONS_FEATURE_BRIEF.md, then summarize the plan for
  the Automations feature before writing any code."* This grounds it in our conventions.
- **Make it plan before building.** For anything non-trivial, ask: *"Plan this first,
  don't write code yet."* Review the plan, correct it, then say "go." Catching a wrong
  assumption in the plan is far cheaper than in the code.
- **Point it at the reference.** Our Campaigns feature is the template (see 2.3). Say
  *"Build the Automations list page modeled on the Campaigns list page."* Concrete file
  references produce far better output than vague asks.
- **Make it read the framework docs.** This repo pins a newer Next.js (see 2.1). Tell it
  *"read the relevant guide in node_modules/next/dist/docs before writing routing or
  server-component code."*
- **Have it self-check before committing.** Ask it to run `npx tsc --noEmit`,
  `npx eslint <files>`, and `npm run build`, and fix anything that fails — every time,
  before it commits.
- **Review the diffs.** Claude Code shows you what it changed. Skim it. If something
  looks off, say so — it'll revise. Don't rubber-stamp large changes blindly.
- **Work in small chunks.** One phase (see 3.6) per session/PR. Long sessions drift;
  tight scope keeps quality high.
- **It can do the ops too.** "Create a branch," "commit this," "open a PR," "write the
  migration SQL and apply it to Supabase" — it runs all of that. You rarely touch a
  terminal yourself.

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

### 2.4 Reviewing your work — preview deployments (no local dev needed)
Nobody on this team runs local versions to review. We use **Vercel preview
deployments**: every branch and every PR automatically gets its own live URL.

- Push a branch → Vercel builds it → a preview URL appears (on the PR, and in the Vercel
  dashboard under Deployments, e.g. `motherboard-git-feat-automations-…vercel.app`).
- Share that URL with Cedric to review the feature on a real, hosted site — no local
  setup on his end.
- **One-time setup so previews can reach the database:** preview deployments use the
  **Preview** environment's env vars, which may be empty by default. In the Vercel
  project → **Settings → Environment Variables**, make sure the **Preview** environment
  has the same values as Production (at minimum `DATABASE_URL`, `NEXTAUTH_SECRET`,
  `NEXTAUTH_URL`, `GOOGLE_CLIENT_ID/SECRET`, `ALLOWED_EMAIL_DOMAIN`). Quickest way:
  in the env var list, edit each production var and tick "Preview" too, or use
  `vercel env add`. You have the access to do this.
  - Note `NEXTAUTH_URL` is awkward for previews (the URL changes per branch). For
    reviewing the Automations UI this rarely matters; if Google login misbehaves on a
    preview, test that part locally or on production and use the preview just for the
    visual/flow review.
- **Database for previews:** since the Automations feature only *adds* new tables, it's
  safe for previews to share the production database — new tables don't affect existing
  features. If you'd rather isolate, spin up a second free Supabase project, run the
  migrations there, and point the Preview `DATABASE_URL` at it. Optional; not needed for
  v1.

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

> **Migrations — you run these yourself.** You have Supabase access via the CAIO
> account. Workflow: (1) update the Drizzle schema in `src/lib/db/schema.ts`, (2) write
> a matching **idempotent** SQL file under `supabase/migrations/NNNN_*.sql` (use
> `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS` so it's safe to re-run),
> (3) paste it into the Supabase **SQL Editor** and run it. Keep the schema file and the
> SQL file in sync — Drizzle is the app's source of truth, the SQL file is the record of
> what's been applied to prod. Look at existing files in `supabase/migrations/` for the
> exact style.

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
- **Migrations:** idempotent SQL file in `supabase/migrations/`, then run it yourself in
  the Supabase SQL Editor. Keep it in sync with the Drizzle schema.
- **Secrets:** env vars only (pull/manage via Vercel). Never commit `.env.local`, never
  paste secrets into Discord.
- **Commit style:** look at `git log` — short imperative subject, a body explaining the
  "why." Keep PRs scoped to one phase.
- **When in doubt, copy Campaigns.** It's the closest working example of everything
  this feature needs.

Questions → ping Cedric on Discord. Welcome aboard.
