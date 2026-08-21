#!/usr/bin/env node
// =============================================================
// Read-only query tool for the live Motherboard database
// =============================================================
// Lets anyone (or Claude) inspect what's actually in Motherboard without
// opening the Supabase dashboard — "is that product archived?", "which
// affiliates are active?", "what did we actually charge for that order?".
//
// SAFETY: read-only by default. Anything that isn't a single SELECT/WITH
// statement is refused unless you pass --allow-write, so a typo can't mutate
// production data.
//
// Usage:
//   node scripts/db-query.mjs "SELECT name, slug, active FROM partner_programs"
//   node scripts/db-query.mjs --preset programs
//   node scripts/db-query.mjs --list          # show the built-in presets
//   node scripts/db-query.mjs --json "SELECT ..."   # raw JSON instead of a table
//
// Reads DATABASE_URL from .env.local or the environment. Get the connection
// string from: Supabase Dashboard → Project Settings → Database →
// Connection string → "Transaction pooler".
// =============================================================

import postgres from "postgres";
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

// ---- Handy presets --------------------------------------------------------
const PRESETS = {
  programs: `SELECT name, slug, active,
       (archived_at IS NOT NULL) AS archived,
       sales_led, is_sample,
       (list_value_cents / 100.0) AS list_value_usd,
       stripe_price_id
FROM partner_programs
ORDER BY archived_at NULLS FIRST, list_value_cents DESC`,

  affiliates: `SELECT name, email, ref_code, status, is_sample,
       stripe_connect_status, approved_at
FROM partners
WHERE is_sample = false
ORDER BY created_at DESC
LIMIT 50`,

  conversions: `SELECT c.created_at, c.buyer_email, p.name AS program,
       (c.gross_cents / 100.0) AS gross_usd,
       (c.commission_cents / 100.0) AS commission_usd,
       c.status, pa.ref_code AS affiliate
FROM partner_conversions c
LEFT JOIN partner_programs p ON p.id = c.program_id
LEFT JOIN partners pa ON pa.id = c.partner_id
WHERE c.is_sample = false
ORDER BY c.created_at DESC
LIMIT 25`,

  payouts: `SELECT period_yyyymm, status, (total_cents / 100.0) AS total_usd,
       generated_at, paid_at
FROM partner_payout_batches
ORDER BY period_yyyymm DESC
LIMIT 20`,

  settings: `SELECT effective_from, default_commission_rate, payout_terms_days,
       (min_payout_cents / 100.0) AS min_payout_usd, cookie_window_days
FROM partner_settings
ORDER BY effective_from DESC
LIMIT 5`,
};

// ---- Args -----------------------------------------------------------------
const argv = process.argv.slice(2);
const asJson = argv.includes("--json");
const allowWrite = argv.includes("--allow-write");

if (argv.includes("--list")) {
  console.log("Available presets:\n");
  for (const [name, sql] of Object.entries(PRESETS)) {
    console.log(`  ${name}\n    ${sql.split("\n")[0]}…\n`);
  }
  process.exit(0);
}

let sql;
const presetIdx = argv.indexOf("--preset");
if (presetIdx !== -1) {
  const name = argv[presetIdx + 1];
  sql = PRESETS[name];
  if (!sql) {
    console.error(
      `Unknown preset "${name}". Run with --list to see the options.`,
    );
    process.exit(1);
  }
} else {
  sql = argv.find((a) => !a.startsWith("--"));
}

if (!sql) {
  console.error(
    'Usage: node scripts/db-query.mjs "SELECT …"  |  --preset <name>  |  --list',
  );
  process.exit(1);
}

// ---- Read-only guard ------------------------------------------------------
// Strip comments, then require the statement to start with SELECT or WITH and
// contain no statement separator followed by more SQL.
const stripped = sql
  .replace(/--[^\n]*/g, "")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .trim();
const isReadOnly =
  /^(select|with)\b/i.test(stripped) && !/;\s*\S/.test(stripped);

if (!isReadOnly && !allowWrite) {
  console.error(
    "Refused: this tool is read-only.\n" +
      "Only a single SELECT/WITH statement is allowed.\n" +
      "Run migrations in the Supabase SQL editor instead, or pass --allow-write " +
      "if you really mean it.",
  );
  process.exit(1);
}

// ---- Connect + run --------------------------------------------------------
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error(
    "DATABASE_URL is not set.\n\n" +
      "Create a .env.local in the project root containing:\n" +
      '  DATABASE_URL="postgresql://…"\n\n' +
      "Get it from: Supabase Dashboard → Project Settings → Database →\n" +
      'Connection string → "Transaction pooler".\n' +
      "(.env.local is gitignored, so it never gets committed.)",
  );
  process.exit(1);
}

const client = postgres(connectionString, {
  prepare: false, // required for the Supabase transaction pooler
  max: 1,
  idle_timeout: 5,
  connect_timeout: 10,
});

try {
  const rows = await client.unsafe(stripped);
  if (asJson) {
    console.log(JSON.stringify(rows, null, 2));
  } else if (rows.length === 0) {
    console.log("(no rows)");
  } else {
    console.table(rows.map((r) => ({ ...r })));
    console.log(`\n${rows.length} row(s)`);
  }
} catch (err) {
  console.error("Query failed:", err.message);
  process.exitCode = 1;
} finally {
  await client.end({ timeout: 5 });
}
