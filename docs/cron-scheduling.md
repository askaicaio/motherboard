# Cron scheduling — how Motherboard's background jobs run

Motherboard has 8 background jobs (commission promotion, payout generation, GHL
syncs, the monthly affiliate report). They used to be **Vercel Cron** entries in
`vercel.json`. They now run from **Upstash QStash**, which calls the same
`/api/cron/*` routes over HTTPS.

**Nothing about the route code changed.** Every cron route already authenticated
with a plain `Authorization: Bearer <CRON_SECRET>` header and nothing
Vercel-specific, so any scheduler that can send a custom header can drive them.

---

## Why QStash

| Requirement | Why it matters | QStash free tier |
| --- | --- | --- |
| 8 schedules | We have 8 jobs | 10 active schedules |
| Custom `Authorization` header | The routes reject anything else | `Upstash-Forward-Authorization` |
| GET requests | The routes only export `GET` | `Upstash-Method: GET` |
| Long request tolerance | Routes declare `maxDuration = 300` | **15-minute** timeout |
| Daily volume | We send ~99/day | 1,000 messages/day |

The timeout row is the one that rules most free schedulers out. `cron-job.org`,
for example, cuts the connection at **30 seconds** and counts it a failure — then
auto-disables any job after 25 consecutive failures. The GHL sync routes
routinely run longer than 30s, so they would have been switched off silently
within a couple of hours.

---

## One-time setup

### 1. Create the QStash account

1. Go to <https://console.upstash.com> and sign in.
2. Open **QStash** in the left sidebar.
3. Under **Request Builder** / **Details**, find the **QSTASH_TOKEN**. Copy it.

### 2. Put the three values in `.env.local`

Open `.env.local` in the project root (same folder as `package.json`) and add:

```
QSTASH_TOKEN=<the token you just copied>
CRON_SECRET=<the same CRON_SECRET that is set in Vercel>
APP_URL=https://affiliates.chiefaiofficer.com
```

`CRON_SECRET` must match Vercel exactly, or every job will come back `401`.
Get it from Vercel → Project → **Settings → Environment Variables → CRON_SECRET**.

### 3. See what will happen before changing anything

```bash
node scripts/qstash-schedules.mjs plan
```

This only reads. It prints the 8 schedules it would create and the estimated
daily message count.

### 4. Create the schedules

```bash
node scripts/qstash-schedules.mjs sync --yes
```

### 5. Confirm they are live

```bash
node scripts/qstash-schedules.mjs list
```

You should see 8 schedules pointing at `affiliates.chiefaiofficer.com`.

---

## The schedule

All times UTC. Defined in [`scripts/qstash-schedules.mjs`](../scripts/qstash-schedules.mjs),
which is the **source of truth** — change it there and re-run `sync`, not in the
QStash console, or the next sync overwrites your edit.

| Job | Schedule | Notes |
| --- | --- | --- |
| `sync-ghl-campaigns` | hourly | **was `*/5`** |
| `sync-automations` | hourly | **was `*/5`** |
| `promote-pending-to-earned` | hourly | |
| `test-product-refunds` | hourly | |
| `sync-customers-index` | 06:00 daily | |
| `sync-ghl-affiliates` | 06:30 daily | staggered off 06:00 |
| `auto-generate-payouts` | 08:00 daily | |
| `affiliate-report-monthly` | 13:00 on the 1st | |

### Why the two syncs went from every 5 minutes to hourly

It cuts total runs from **~19,400/month to ~2,971/month** (−84%), and QStash
daily messages from 627 to ~99 — leaving 10× headroom on the free tier instead
of running at 63% of it.

The tradeoff: GHL campaign stats and automation status can be up to an hour
stale instead of 5 minutes. The Automations tab's manual **"Check for New
Errors"** button is unaffected and still works on demand.

To go back to 5-minute syncs, change those two `cron` values to `*/5 * * * *`
in the script and re-run `sync --yes`. That puts you at 627 messages/day, which
still fits the free tier but leaves much less room for retries.

---

## Changing a schedule

1. Edit the `SCHEDULES` array in [`scripts/qstash-schedules.mjs`](../scripts/qstash-schedules.mjs).
2. `node scripts/qstash-schedules.mjs plan` to check.
3. `node scripts/qstash-schedules.mjs sync --yes`.

`sync` deletes Motherboard's existing schedules and recreates all 8 from the
file, so the file always wins.

---

## If a job stops running

1. **Check QStash first.** Upstash console → QStash → **Schedules**, then
   **Events** or the DLQ. Logs are kept 3 days on the free tier.
2. **A `401` means `CRON_SECRET` drifted.** The value in `.env.local` (used when
   the schedule was created) must match the one in Vercel. Changing it in Vercel
   requires re-running `sync --yes` with the new value.
3. **Check the Vercel function logs** for the route to see whether it was reached
   at all.

### Rotating `CRON_SECRET`

These routes are reachable by anyone who learns the URL, so the secret is the
only thing protecting them, and QStash now holds a copy.

1. Set the new value in Vercel → Settings → Environment Variables, and redeploy.
2. Update `CRON_SECRET` in `.env.local`.
3. `node scripts/qstash-schedules.mjs sync --yes` to re-issue all 8 schedules
   with the new header.

Do steps 1–3 close together — between the redeploy and the re-sync, every job
gets a `401`.

---

## Going back to Vercel Cron

Add a `crons` block back to `vercel.json` with the paths and schedules above,
redeploy, then `node scripts/qstash-schedules.mjs delete-all --yes` so the jobs
don't fire twice. Note that sub-daily schedules require a Vercel plan that
allows them — on Hobby, an expression that runs more than once a day **fails the
deployment**.
