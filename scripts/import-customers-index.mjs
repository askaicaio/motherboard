#!/usr/bin/env node
// =============================================================
// Customers-index CSV → seed SQL
// =============================================================
// Parses a CSV of every prior CAIO buyer (export from GHL +
// Circle + Stripe combined) and emits an idempotent SQL file that
// INSERTs them into customers_index. The new-customer gate (Terms
// §3.2) reads this table — without it, every buyer looks new and
// affiliate commissions get over-paid.
//
// Usage:
//   node scripts/import-customers-index.mjs \
//     "files/customers-2026-06-XX.csv" \
//     supabase/seeds/customers-index-2026-06-XX.sql
//
// CSV columns (header row required, in any order):
//   email                  (required)
//   first_purchase_at      (optional — ISO 8601 or YYYY-MM-DD; defaults to NULL → DB default)
//   source                 (optional — "ghl" | "circle" | "stripe" | "manual" | free-form)
//   notes                  (optional)
//
// Output uses ON CONFLICT (email) DO NOTHING so re-imports never
// clobber a first_purchase_at value that a live ingestConversion
// call has already extended for a row.
//
// Batches 500 rows per INSERT to stay well under Supabase statement
// size limits and keep the table briefly locked per batch rather
// than for the whole import.
// =============================================================

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const [, , csvPath, outPath] = process.argv;
if (!csvPath || !outPath) {
  console.error(
    "Usage: node scripts/import-customers-index.mjs <csv-input> <sql-output>",
  );
  process.exit(1);
}

const BATCH_SIZE = 500;

// ---- RFC 4180-style parser (same as import-subscriptions) ------------
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
        // ignore
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

function sql(v) {
  if (v === null || v === undefined || v === "") return "NULL";
  return "'" + String(v).replace(/'/g, "''") + "'";
}

// Permissive date normaliser: tries ISO, then "YYYY-MM-DD", falls back to null
function normalizeDate(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!s) return null;
  // Already ISO-ish?
  const dt = new Date(s);
  if (!isNaN(dt.getTime())) return dt.toISOString();
  return null;
}

const text = readFileSync(csvPath, "utf8");
const rows = parseCsv(text);
if (rows.length === 0) {
  console.error("Empty CSV — nothing to import.");
  process.exit(1);
}

const header = rows[0].map((h) => h.trim().toLowerCase());
const idx = {
  email: header.indexOf("email"),
  firstPurchaseAt: header.indexOf("first_purchase_at"),
  source: header.indexOf("source"),
  notes: header.indexOf("notes"),
};
if (idx.email === -1) {
  console.error("CSV is missing required `email` column.");
  process.exit(1);
}

const seen = new Set();
const records = [];
let skippedEmpty = 0;
let skippedDup = 0;

for (let i = 1; i < rows.length; i++) {
  const r = rows[i];
  if (!r || !r[idx.email]) {
    skippedEmpty++;
    continue;
  }
  const email = r[idx.email].trim().toLowerCase();
  if (!email || !email.includes("@")) {
    skippedEmpty++;
    continue;
  }
  if (seen.has(email)) {
    skippedDup++;
    continue;
  }
  seen.add(email);

  const firstPurchaseAt =
    idx.firstPurchaseAt >= 0
      ? normalizeDate(r[idx.firstPurchaseAt])
      : null;
  const source =
    idx.source >= 0 ? (r[idx.source] || "").trim() || null : null;
  const notes =
    idx.notes >= 0 ? (r[idx.notes] || "").trim() || null : null;

  records.push({ email, firstPurchaseAt, source, notes });
}

// Batch into 500-row INSERTs
const batches = [];
for (let i = 0; i < records.length; i += BATCH_SIZE) {
  batches.push(records.slice(i, i + BATCH_SIZE));
}

const sqlChunks = batches.map((batch, batchIdx) => {
  const values = batch
    .map(
      (r) =>
        `  (${sql(r.email)}, ${
          r.firstPurchaseAt ? `${sql(r.firstPurchaseAt)}::timestamptz` : "now()"
        }, ${sql(r.source)}, ${sql(r.notes)})`,
    )
    .join(",\n");
  return `-- Batch ${batchIdx + 1} of ${batches.length} (${batch.length} rows)
INSERT INTO customers_index (email, first_purchase_at, source, notes) VALUES
${values}
ON CONFLICT (email) DO NOTHING;`;
});

const out = `-- =============================================================
-- Customers-index seed — generated from
-- ${csvPath.replace(/\\/g, "/")}
-- Generated by scripts/import-customers-index.mjs
--
-- Rows in CSV:    ${rows.length - 1}
-- Rows inserted:  ${records.length}
-- Skipped empty:  ${skippedEmpty}
-- Skipped dupes:  ${skippedDup}
-- Batches:        ${batches.length} of ${BATCH_SIZE}
--
-- ON CONFLICT (email) DO NOTHING — re-runs are safe and never clobber
-- a first_purchase_at that a live conversion has already extended.
-- =============================================================

${sqlChunks.join("\n\n")}

-- Verify
SELECT COUNT(*) AS total_rows FROM customers_index;
`;

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, out, "utf8");
console.log(
  `✓ Wrote ${records.length} rows in ${batches.length} batches to ${outPath}`,
);
console.log(
  `  Skipped: ${skippedEmpty} empty, ${skippedDup} duplicate emails`,
);
