#!/usr/bin/env node
// =============================================================
// Subscriptions CSV → seed SQL
// =============================================================
// Parses the ClickUp "Accounts" CSV export and emits an idempotent
// SQL file that INSERTs all rows into `subscriptions`. The SQL uses
// ON CONFLICT (external_id) DO UPDATE so re-imports refresh data
// instead of duplicating.
//
// Usage:
//   node scripts/import-subscriptions.mjs \
//     "files/2026-06-02T16_57_14.152Z Chief AI Officer - Admin - Database - Accounts.csv" \
//     supabase/seeds/subscriptions-from-csv-2026-06-02.sql
//
// The output file can then be pasted into Supabase SQL Editor.
// =============================================================

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const [, , csvPath, outPath] = process.argv;
if (!csvPath || !outPath) {
  console.error(
    "Usage: node scripts/import-subscriptions.mjs <csv-input> <sql-output>",
  );
  process.exit(1);
}

// ─── RFC 4180-style CSV parser ───────────────────────────────────────────
// Handles quoted fields with embedded commas and newlines, doubled quotes
// as escapes. Returns rows as string[][].
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else {
      if (c === '"') {
        inQuotes = true;
      } else if (c === ",") {
        row.push(field);
        field = "";
      } else if (c === "\r") {
        // ignore — handled by \n
      } else if (c === "\n") {
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
      } else {
        field += c;
      }
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

// ─── Field normalisers ───────────────────────────────────────────────────

/** Split "[A, B, C]" into ["A","B","C"]. Returns [] for empty/garbage. */
function parseDepartmentList(raw) {
  if (!raw) return [];
  const inner = raw.replace(/^\[|\]$/g, "").trim();
  if (!inner) return [];
  return inner
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** "*1Password" → { name: "1Password", starred: true }. */
function parseName(raw) {
  const name = (raw || "").trim();
  if (name.startsWith("*")) {
    return { name: name.slice(1).trim(), starred: true };
  }
  return { name, starred: false };
}

/** "ChatGPT | doc@chiefaiofficer.com" → service "ChatGPT", owner "doc@…". */
function splitNameAndOwner(name) {
  const idx = name.indexOf("|");
  if (idx === -1) return { service: name.trim() || null, owner: null };
  const service = name.slice(0, idx).trim() || null;
  const right = name.slice(idx + 1).trim();
  // Right side is usually an email. Accept it only if it looks like one.
  const owner = /^\S+@\S+\.\S+$/.test(right) ? right.toLowerCase() : null;
  return { service, owner };
}

/** "Sunday, July 26th 2026" → "2026-07-26". Returns null on parse failure. */
const MONTHS = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};
function parseRenewalDate(raw) {
  if (!raw) return null;
  const s = raw.trim();
  if (!s) return null;
  // "Sunday, July 26th 2026" — capture month, day, year
  const m = s.match(
    /(?:\w+,\s*)?([A-Za-z]+)\s+(\d+)(?:st|nd|rd|th)\s+(\d{4})/,
  );
  if (!m) return null;
  const month = MONTHS[m[1].toLowerCase()];
  const day = parseInt(m[2], 10);
  const year = parseInt(m[3], 10);
  if (!month || !day || !year) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Currency from CSV: number or empty string or "false"/"" garbage. */
function parseCurrency(raw) {
  if (raw === undefined || raw === null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  // Truncate float drift to 2 dp
  return Math.round(n * 100) / 100;
}

function parseBool(raw) {
  if (!raw) return false;
  const s = String(raw).trim().toLowerCase();
  return s === "true" || s === "yes" || s === "1";
}

/** Postgres single-quote escape. */
function sql(s) {
  if (s === null || s === undefined) return "NULL";
  return "'" + String(s).replace(/'/g, "''") + "'";
}

/** Build a Postgres text[] literal: ARRAY['a','b']::text[] or '{}'. */
function sqlTextArray(arr) {
  if (!arr || arr.length === 0) return `'{}'::text[]`;
  const inner = arr
    .map((s) => `'${String(s).replace(/'/g, "''")}'`)
    .join(",");
  return `ARRAY[${inner}]::text[]`;
}

function sqlNumeric(n) {
  return n === null ? "NULL" : String(n);
}

// ─── Main ─────────────────────────────────────────────────────────────────

const csv = readFileSync(csvPath, "utf8");
const rows = parseCsv(csv);
const [header, ...data] = rows;

const colIdx = {
  taskId: header.indexOf("Task ID"),
  taskName: header.indexOf("Task Name"),
  website: header.indexOf("Website Link (url)"),
  departments: header.indexOf("Department (labels)"),
  in1p: header.indexOf("In 1Password (checkbox)"),
  monthly: header.indexOf("Subscription Amount (per month) (currency)"),
  annual: header.indexOf("Annual Cost (formula)"),
  renewal: header.indexOf("Renewal Date (date)"),
  notes: header.indexOf("Notes (text)"),
  tag: header.indexOf("Tag (drop down)"),
  status: header.indexOf("Status"),
};

const inserts = [];
let archivedCount = 0;
let skippedNoName = 0;

for (const row of data) {
  if (!row || row.length === 0) continue;

  const taskId = (row[colIdx.taskId] || "").trim() || null;
  const rawName = row[colIdx.taskName] || "";
  if (!rawName.trim()) {
    skippedNoName++;
    continue;
  }

  const { name, starred } = parseName(rawName);
  const { service, owner } = splitNameAndOwner(name);

  const allDepts = parseDepartmentList(row[colIdx.departments] || "");
  const isArchived = allDepts.some((d) => d.toLowerCase() === "*archived");
  // Strip the *Archived sentinel — status field carries that semantic instead
  const departments = allDepts.filter(
    (d) => d.toLowerCase() !== "*archived",
  );
  if (isArchived) archivedCount++;

  const monthly = parseCurrency(row[colIdx.monthly]);
  let annual = parseCurrency(row[colIdx.annual]);
  // Backfill annual from monthly when CSV had it blank
  if (annual === null && monthly !== null) annual = Math.round(monthly * 1200) / 100;

  const renewalDate = parseRenewalDate(row[colIdx.renewal]);
  const notesRaw = (row[colIdx.notes] || "").replace(/\s+$/, "");
  const notes = notesRaw || null;
  const tag = (row[colIdx.tag] || "").trim() || null;
  const websiteUrl = (row[colIdx.website] || "").trim() || null;
  const inOnePassword = parseBool(row[colIdx.in1p]);
  // ClickUp Status (the new column) is the source of truth for status.
  // The *Archived department marker is a separate axis — it sets
  // archived_at (soft-delete from default view) but no longer touches
  // the status string.
  const rawStatus =
    colIdx.status >= 0 ? (row[colIdx.status] || "").trim() : "";
  const status = rawStatus || (isArchived ? "archived" : "active");
  const archivedAt = isArchived ? "now()" : "NULL";

  inserts.push(
    `(${[
      sql(taskId),
      sql(name),
      sql(service),
      sql(owner),
      starred ? "true" : "false",
      sql(websiteUrl),
      sqlTextArray(departments),
      inOnePassword ? "true" : "false",
      sqlNumeric(monthly),
      sqlNumeric(annual),
      renewalDate ? `'${renewalDate}'::date` : "NULL",
      sql(notes),
      sql(tag),
      sql(status),
      archivedAt,
    ].join(", ")})`,
  );
}

const sqlOut = `-- =============================================================
-- Subscriptions seed — generated from
-- ${csvPath.replace(/\\/g, "/")}
-- Generated by scripts/import-subscriptions.mjs
--
-- Rows: ${inserts.length} (${archivedCount} archived)
-- Skipped (no name): ${skippedNoName}
--
-- Idempotent — re-running upserts on external_id.
-- =============================================================

INSERT INTO subscriptions (
  external_id, name, service_name, owner_email, is_starred,
  website_url, departments, in_one_password,
  monthly_cost_usd, annual_cost_usd, renewal_date,
  notes, tag, status, archived_at
) VALUES
${inserts.join(",\n")}
ON CONFLICT (external_id) DO UPDATE SET
  name             = EXCLUDED.name,
  service_name     = EXCLUDED.service_name,
  owner_email      = EXCLUDED.owner_email,
  is_starred       = EXCLUDED.is_starred,
  website_url      = EXCLUDED.website_url,
  departments      = EXCLUDED.departments,
  in_one_password  = EXCLUDED.in_one_password,
  monthly_cost_usd = EXCLUDED.monthly_cost_usd,
  annual_cost_usd  = EXCLUDED.annual_cost_usd,
  renewal_date     = EXCLUDED.renewal_date,
  notes            = EXCLUDED.notes,
  tag              = EXCLUDED.tag,
  status           = EXCLUDED.status,
  archived_at      = EXCLUDED.archived_at,
  updated_at       = now();

-- Verify
SELECT
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE status = 'active') AS active,
  COUNT(*) FILTER (WHERE status = 'archived') AS archived,
  SUM(monthly_cost_usd) AS total_monthly,
  SUM(annual_cost_usd) AS total_annual
FROM subscriptions;
`;

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, sqlOut, "utf8");
console.log(`✓ Wrote ${inserts.length} rows to ${outPath}`);
console.log(`  ${archivedCount} marked archived, ${skippedNoName} skipped (no name)`);
