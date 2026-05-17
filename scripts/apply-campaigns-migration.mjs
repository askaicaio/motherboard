#!/usr/bin/env node
// =============================================================
// One-shot migration runner for 0011_add_campaigns.sql.
//
// Usage:
//   node scripts/apply-campaigns-migration.mjs
//
// Reads DATABASE_URL from .env.local or env. Idempotent — safe to re-run.
// =============================================================

import postgres from "postgres";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");

// Lazy .env.local loader (no dotenv dependency required)
function loadEnv() {
  const p = resolve(projectRoot, ".env.local");
  if (!existsSync(p)) return;
  const lines = readFileSync(p, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!m) continue;
    let val = m[2].trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[m[1]]) process.env[m[1]] = val;
  }
}
loadEnv();

const url = process.env.DATABASE_URL;
if (!url) {
  console.error(
    "✗ DATABASE_URL not found. Either pull it via `vercel env pull` " +
      "or set it inline:\n   DATABASE_URL='postgres://...' node scripts/apply-campaigns-migration.mjs",
  );
  process.exit(1);
}

const sqlPath = resolve(
  projectRoot,
  "supabase/migrations/0011_add_campaigns.sql",
);
const sqlText = readFileSync(sqlPath, "utf8");

const sql = postgres(url, { prepare: false, max: 1 });

try {
  console.log("→ Applying 0011_add_campaigns.sql …");
  await sql.unsafe(sqlText);
  console.log("✓ Migration applied.");

  // Verify
  const tables = await sql`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN ('campaigns','campaign_people','campaign_leads','campaign_events')
    ORDER BY table_name
  `;
  console.log(`✓ Tables present: ${tables.map((t) => t.table_name).join(", ")}`);
} catch (err) {
  console.error("✗ Migration failed:", err.message);
  process.exit(1);
} finally {
  await sql.end();
}
