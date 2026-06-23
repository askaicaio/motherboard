// POST /api/partners/customers-import
// ------------------------------------------------------------------
// Admin-only one-shot upload of the customers_index seed. Accepts a
// CSV body (text/csv or text/plain) or a JSON array of records. Same
// shape as scripts/import-customers-index.mjs accepts:
//   email (required), first_purchase_at, source, notes
//
// Streams rows in batches of 500 via raw SQL with ON CONFLICT
// (email) DO NOTHING so concurrent live ingestion isn't blocked and
// a prior first_purchase_at is never clobbered.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { customersIndex } from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/guard";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const recordSchema = z.object({
  email: z.string().email().toLowerCase(),
  first_purchase_at: z.string().datetime().optional().nullable(),
  source: z.string().max(100).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

const BATCH_SIZE = 500;

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
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
      if (c === '"') inQuotes = true;
      else if (c === ",") {
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

interface NormalizedRecord {
  email: string;
  first_purchase_at: string | null;
  source: string | null;
  notes: string | null;
}

function normalizeCsv(text: string): NormalizedRecord[] {
  const rows = parseCsv(text);
  if (rows.length === 0) return [];
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const idx = {
    email: header.indexOf("email"),
    firstPurchaseAt: header.indexOf("first_purchase_at"),
    source: header.indexOf("source"),
    notes: header.indexOf("notes"),
  };
  if (idx.email === -1) {
    throw new Error("CSV is missing required `email` column");
  }
  const seen = new Set<string>();
  const out: NormalizedRecord[] = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || !r[idx.email]) continue;
    const email = r[idx.email].trim().toLowerCase();
    if (!email.includes("@") || seen.has(email)) continue;
    seen.add(email);
    const first_purchase_at_raw =
      idx.firstPurchaseAt >= 0 ? (r[idx.firstPurchaseAt] || "").trim() : "";
    let first_purchase_at: string | null = null;
    if (first_purchase_at_raw) {
      const dt = new Date(first_purchase_at_raw);
      if (!isNaN(dt.getTime())) first_purchase_at = dt.toISOString();
    }
    out.push({
      email,
      first_purchase_at,
      source:
        idx.source >= 0 ? (r[idx.source] || "").trim() || null : null,
      notes:
        idx.notes >= 0 ? (r[idx.notes] || "").trim() || null : null,
    });
  }
  return out;
}

export async function POST(request: NextRequest) {
  await requireRole("admin");

  const contentType = request.headers.get("content-type") || "";
  let records: NormalizedRecord[] = [];

  try {
    if (contentType.includes("application/json")) {
      const body = await request.json();
      const arr = Array.isArray(body) ? body : body.records;
      if (!Array.isArray(arr)) {
        return NextResponse.json(
          { error: "Expected an array of records, or { records: [...] }" },
          { status: 400 },
        );
      }
      const parsed = arr.map((r) => recordSchema.parse(r));
      const seen = new Set<string>();
      records = parsed
        .filter((r) => {
          if (seen.has(r.email)) return false;
          seen.add(r.email);
          return true;
        })
        .map((r) => ({
          email: r.email,
          first_purchase_at: r.first_purchase_at ?? null,
          source: r.source ?? null,
          notes: r.notes ?? null,
        }));
    } else {
      const text = await request.text();
      records = normalizeCsv(text);
    }
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", issues: err.issues },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Parse failed" },
      { status: 400 },
    );
  }

  if (records.length === 0) {
    return NextResponse.json(
      { ok: true, inserted: 0, message: "No valid records found" },
      { status: 200 },
    );
  }

  // Insert in batches with ON CONFLICT DO NOTHING. Drizzle's
  // .onConflictDoNothing() gives us this without raw SQL.
  let attempted = 0;
  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    await db
      .insert(customersIndex)
      .values(
        batch.map((r) => ({
          email: r.email,
          // If the caller didn't supply a date, fall back to the column default
          // (now()) by NOT passing the field — Drizzle handles that.
          ...(r.first_purchase_at
            ? { firstPurchaseAt: new Date(r.first_purchase_at) }
            : {}),
          source: r.source,
          notes: r.notes,
        })),
      )
      .onConflictDoNothing({ target: customersIndex.email });
    attempted += batch.length;
  }

  const [{ count }] = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(customersIndex);

  return NextResponse.json({
    ok: true,
    attempted,
    table_total: count,
  });
}
