#!/usr/bin/env node
// =============================================================
// QStash cron schedules for Motherboard
// =============================================================
// Motherboard's background jobs used to be Vercel Cron entries in vercel.json.
// They now run from Upstash QStash, which calls the same /api/cron/* routes
// over HTTPS. Nothing about the routes changed — QStash just forwards the
// Authorization header they already check.
//
// THIS FILE IS THE SOURCE OF TRUTH for the schedule. vercel.json no longer
// has a "crons" block, so if you want to change when something runs, change
// SCHEDULES below and re-run `sync` — don't edit it only in the QStash console,
// or the next sync will overwrite it.
//
// SAFETY: read-only by default. `list` only reads; `sync` and `delete-all`
// both require --yes so nothing is changed by a stray command.
//
// Usage:
//   node scripts/qstash-schedules.mjs list               # what's live right now
//   node scripts/qstash-schedules.mjs plan               # what sync WOULD do
//   node scripts/qstash-schedules.mjs sync --yes         # make live match this file
//   node scripts/qstash-schedules.mjs delete-all --yes   # remove Motherboard's schedules
//
// Needs these in .env.local or the environment:
//   QSTASH_TOKEN  — Upstash console → QStash → copy the token
//   CRON_SECRET   — the same value set in Vercel's env vars
//   APP_URL       — e.g. https://affiliates.chiefaiofficer.com (no trailing slash)
// =============================================================

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");

// ---- Lazy .env.local loader (no dotenv dependency) ------------------------
function loadEnv() {
  const envPath = resolve(projectRoot, ".env.local");
  if (!existsSync(envPath)) return;
  for (const rawLine of readFileSync(envPath, "utf8").split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}
loadEnv();

// =============================================================
// The schedule
// =============================================================
// All times are UTC. `retries: 1` means two delivery attempts total — QStash
// bills every attempt as a message against the 1,000/day free allowance, so
// the default of 3 is deliberately not used.
//
// The two sync jobs run HOURLY, not every 5 minutes as they did on Vercel.
// That drops total runs from ~19,400/month to ~2,971/month. The tradeoff is
// that GHL campaign and automation data can be up to an hour stale.
const SCHEDULES = [
  {
    path: "/api/cron/sync-ghl-campaigns",
    cron: "0 * * * *",
    note: "Pull GHL campaign stats. Was */5; hourly since the QStash move.",
  },
  {
    path: "/api/cron/sync-automations",
    cron: "0 * * * *",
    note: "Automations auto-refresh + error capture + API health. Was */5.",
  },
  {
    path: "/api/cron/promote-pending-to-earned",
    cron: "0 * * * *",
    note: "Flip matured commissions pending -> earned and notify affiliates.",
  },
  {
    path: "/api/cron/test-product-refunds",
    cron: "0 * * * *",
    note: "Auto-refund the $1 test product.",
  },
  {
    path: "/api/cron/sync-customers-index",
    cron: "0 6 * * *",
    note: "Rebuild the direct-purchase customer index.",
  },
  {
    path: "/api/cron/sync-ghl-affiliates",
    cron: "30 6 * * *",
    note: "Mirror affiliate records into GHL. Staggered off 06:00 so the daily jobs don't all fire together.",
  },
  {
    path: "/api/cron/auto-generate-payouts",
    cron: "0 8 * * *",
    note: "Generate the Net-45 payout batch and release via Stripe Connect.",
  },
  {
    path: "/api/cron/affiliate-report-monthly",
    cron: "0 13 1 * *",
    note: "Email the internal team last month's affiliate report.",
  },
];

const QSTASH_API = "https://qstash.upstash.io/v2";

// ---- Args ----------------------------------------------------------------
const args = process.argv.slice(2);
const command = args.find((a) => !a.startsWith("--")) || "list";
const confirmed = args.includes("--yes");

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(
      `\nMissing ${name}.\n` +
        `Add it to .env.local (same folder as package.json) as:\n` +
        `  ${name}=...\n`,
    );
    process.exit(1);
  }
  return value;
}

function destinationFor(appUrl, path) {
  return `${appUrl.replace(/\/+$/, "")}${path}`;
}

async function qstash(path, options = {}) {
  const token = requireEnv("QSTASH_TOKEN");
  const res = await fetch(`${QSTASH_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`QStash ${options.method || "GET"} ${path} -> ${res.status}: ${text.slice(0, 400)}`);
  }
  return text ? JSON.parse(text) : null;
}

/** Every schedule QStash currently holds whose destination is one of ours. */
async function liveSchedules() {
  const appUrl = requireEnv("APP_URL");
  const all = await qstash("/schedules");
  const ourPaths = new Set(SCHEDULES.map((s) => destinationFor(appUrl, s.path)));
  return (all || []).filter((s) => ourPaths.has(s.destination));
}

async function cmdList() {
  const all = await qstash("/schedules");
  if (!all || all.length === 0) {
    console.log("No QStash schedules exist on this account.");
    return;
  }
  console.log(`${all.length} schedule(s) live on this QStash account:\n`);
  for (const s of all) {
    console.log(`  ${s.cron.padEnd(14)} ${s.destination}`);
    console.log(`  ${"".padEnd(14)} id=${s.scheduleId}  method=${s.method || "POST"}  retries=${s.retries ?? "default"}`);
    console.log("");
  }
}

async function cmdPlan() {
  const appUrl = requireEnv("APP_URL");
  const live = await liveSchedules();
  console.log(`Target app: ${appUrl}\n`);
  console.log(`sync would delete ${live.length} existing Motherboard schedule(s) and create these ${SCHEDULES.length}:\n`);
  for (const s of SCHEDULES) {
    console.log(`  ${s.cron.padEnd(14)} ${s.path}`);
    console.log(`  ${"".padEnd(14)} ${s.note}`);
    console.log("");
  }
  const perDay = SCHEDULES.reduce((n, s) => n + runsPerDay(s.cron), 0);
  console.log(`Estimated ${perDay} messages/day against QStash's 1,000/day free allowance.`);
}

/** Rough daily run count — good enough to sanity-check the free-tier budget. */
function runsPerDay(cron) {
  const [min, hour, dom] = cron.split(" ");
  if (dom !== "*") return 1 / 30;
  if (min.startsWith("*/")) {
    const step = Number(min.slice(2));
    return hour === "*" ? (60 / step) * 24 : 60 / step;
  }
  return hour === "*" ? 24 : 1;
}

async function cmdSync() {
  if (!confirmed) {
    console.error("Refusing to change live schedules without --yes. Run `plan` first to see what would happen.");
    process.exit(1);
  }
  const appUrl = requireEnv("APP_URL");
  const cronSecret = requireEnv("CRON_SECRET");

  const live = await liveSchedules();
  for (const s of live) {
    await qstash(`/schedules/${s.scheduleId}`, { method: "DELETE" });
    console.log(`deleted  ${s.cron.padEnd(14)} ${s.destination}`);
  }

  for (const s of SCHEDULES) {
    const destination = destinationFor(appUrl, s.path);
    const created = await qstash(`/schedules/${destination}`, {
      method: "POST",
      headers: {
        "Upstash-Cron": s.cron,
        // The routes only export GET; QStash defaults to POST without this.
        "Upstash-Method": "GET",
        // Two attempts total. Each attempt is a billed message.
        "Upstash-Retries": "1",
        // Delivered to the route as a plain `Authorization` header — the
        // Upstash-Forward- prefix is stripped on the way out.
        "Upstash-Forward-Authorization": `Bearer ${cronSecret}`,
      },
    });
    console.log(`created  ${s.cron.padEnd(14)} ${s.path}  id=${created?.scheduleId ?? "?"}`);
  }

  console.log(`\nDone. ${SCHEDULES.length} schedules live against ${appUrl}.`);
}

async function cmdDeleteAll() {
  if (!confirmed) {
    console.error("Refusing to delete without --yes.");
    process.exit(1);
  }
  const live = await liveSchedules();
  if (live.length === 0) {
    console.log("Nothing to delete.");
    return;
  }
  for (const s of live) {
    await qstash(`/schedules/${s.scheduleId}`, { method: "DELETE" });
    console.log(`deleted  ${s.cron.padEnd(14)} ${s.destination}`);
  }
}

const COMMANDS = {
  list: cmdList,
  plan: cmdPlan,
  sync: cmdSync,
  "delete-all": cmdDeleteAll,
};

const run = COMMANDS[command];
if (!run) {
  console.error(`Unknown command "${command}". Expected one of: ${Object.keys(COMMANDS).join(", ")}`);
  process.exit(1);
}

run().catch((err) => {
  console.error(`\n${err.message}\n`);
  process.exit(1);
});
