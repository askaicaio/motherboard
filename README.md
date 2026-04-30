# CAIO Internal Dashboard

Internal employee onboarding and provisioning management platform.

## Stack

- **Framework:** Next.js 14+ (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS + shadcn/ui
- **Database:** PostgreSQL via Supabase (Drizzle ORM)
- **Auth:** NextAuth.js (Google OAuth)
- **Orchestration:** n8n (mock mode available for dev)
- **Email:** Resend API

## Getting Started

### Prerequisites

- Node.js 18+
- A Supabase project (or any PostgreSQL instance)
- Google OAuth credentials (for admin login)

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.local.example .env.local
```

Fill in all values in `.env.local`. See the file for documentation on each variable.

### 3. Set up the database

Run the initial migration against your Supabase database:

```bash
# Option A: Apply the raw SQL migration
psql $DATABASE_URL -f supabase/migrations/001_initial_schema.sql

# Option B: Use Drizzle Kit
npx drizzle-kit push
```

### 4. Seed sample data (optional)

```bash
npx tsx src/lib/db/seed.ts
```

### 5. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project Structure

```
src/
  app/                    # Next.js App Router pages + API routes
    (auth)/               # Login page
    (dashboard)/          # All authenticated pages
    api/                  # REST API routes
      onboarding/         # CRUD + approve/provision/retry/email
      callbacks/n8n/      # n8n posts provisioning results here
      rules/              # Provisioning rules CRUD
      audit-log/          # Audit log query endpoint
      settings/           # App settings
  components/             # React components
    ui/                   # shadcn/ui primitives
    layout/               # Sidebar, header
    onboarding/           # Request form, table, status badges, tracker
  lib/
    db/                   # Database client + Drizzle schema
    auth/                 # NextAuth config + auth guards
    providers/            # Provisioning providers (1 per tool)
    rules/                # Rules engine
    email/                # Email template builder
    n8n/                  # n8n webhook client (mock + live)
    audit/                # Audit log writer
    utils/                # Validation, idempotency, status resolver
  types/                  # Shared TypeScript types
```

## Key Features

- **Onboarding form** with 20+ fields, tool multi-select, advanced overrides
- **Rules engine** maps department/division/role to default tool configs
- **Modular provisioning** — each tool (Google Workspace, Slack, ClickUp, GHL, Circle, 1Password) has its own provider implementing a common interface
- **Mock mode** (`PROVISIONING_MODE=mock`) simulates n8n responses for testing
- **Status tracking** — per-request status (10 states) + per-tool status (6 states)
- **Retry failed steps** without duplicating completed ones (idempotency keys)
- **Onboarding email** with conditional content blocks based on provisioned tools
- **Audit log** for every state-changing action, with automatic secret redaction
- **HMAC-signed callbacks** from n8n for security

## Provisioning Flow

1. Admin submits onboarding form → status: `pending_approval`
2. Super admin approves → rules engine creates provisioning steps → status: `approved`
3. Admin clicks "Start Provisioning" → n8n webhooks triggered → status: `provisioning_in_progress`
4. n8n posts results to `/api/callbacks/n8n` → steps updated → request status recomputed
5. Admin previews and sends onboarding email → status: `email_sent` / `complete`

## Adding a New Tool

1. Create `src/lib/providers/your-tool.ts` implementing `ProvisioningProvider`
2. Register it in `src/lib/providers/registry.ts`
3. Add the tool key to `TOOL_KEYS` and `TOOL_DISPLAY_NAMES` in `src/types/index.ts`
4. Add an icon mapping in `src/components/onboarding/tool-selector.tsx`
5. Create the corresponding n8n workflow

## Deployment

Deploy to Vercel:

```bash
vercel --prod
```

Set all environment variables in the Vercel dashboard.

## TODO

- [ ] Connect real n8n workflows for each provider
- [ ] Configure Google OAuth credentials
- [ ] Set up Supabase project and run migrations
- [ ] Add Resend API key for email dispatch
- [ ] Configure n8n webhook secret for HMAC verification
- [ ] Add more provisioning rules for your organization
- [ ] Customize email template blocks for your onboarding flow
