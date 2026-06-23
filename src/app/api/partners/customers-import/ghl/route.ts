// =============================================================
// POST /api/partners/customers-import/ghl
// =============================================================
// Admin-only. Pulls paid buyers from GoHighLevel payments and seeds
// customers_index (new-customer gate). Body: { subaccount: "main" |
// "b2b" | "both" }. Idempotent — ON CONFLICT (email) DO NOTHING keeps
// the earliest first_purchase_at already recorded.
//
// "both" is the right default for the new-customer gate: a buyer who
// purchased on EITHER sub-account is not a new customer.
// =============================================================

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { customersIndex } from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/guard";
import { sql } from "drizzle-orm";
import {
  pullGhlBuyers,
  getGhlSubaccountCreds,
} from "@/lib/integrations/ghl-customers";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const schema = z.object({
  subaccount: z.enum(["main", "b2b", "both"]).default("both"),
});

const BATCH = 500;

export async function POST(request: NextRequest) {
  await requireRole("admin");

  let body;
  try {
    body = schema.parse(await request.json().catch(() => ({})));
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", issues: err.issues },
        { status: 400 },
      );
    }
    throw err;
  }

  const targets: Array<"main" | "b2b"> =
    body.subaccount === "both" ? ["main", "b2b"] : [body.subaccount];

  const perSubaccount: Record<string, number> = {};
  const earliest = new Map<string, Date>();

  for (const sub of targets) {
    const creds = getGhlSubaccountCreds(sub);
    if (!creds) {
      perSubaccount[sub] = -1; // unconfigured
      continue;
    }
    try {
      const buyers = await pullGhlBuyers(creds.token, creds.locationId);
      perSubaccount[sub] = buyers.length;
      for (const b of buyers) {
        const prev = earliest.get(b.email);
        if (!prev || b.firstPurchaseAt.getTime() < prev.getTime()) {
          earliest.set(b.email, b.firstPurchaseAt);
        }
      }
    } catch (err) {
      console.error(`[customers-import/ghl] ${sub} failed:`, err);
      return NextResponse.json(
        {
          error: `GHL pull failed for ${sub}: ${err instanceof Error ? err.message : "unknown"}`,
          perSubaccount,
        },
        { status: 502 },
      );
    }
  }

  // Upsert in batches, never clobbering an existing first_purchase_at.
  const records = Array.from(earliest.entries()).map(([email, when]) => ({
    email,
    firstPurchaseAt: when,
    source: "ghl",
  }));

  for (let i = 0; i < records.length; i += BATCH) {
    const slice = records.slice(i, i + BATCH);
    if (slice.length === 0) continue;
    await db
      .insert(customersIndex)
      .values(slice)
      .onConflictDoNothing({ target: customersIndex.email });
  }

  const [{ total }] = await db
    .select({ total: sql<number>`COUNT(*)::int` })
    .from(customersIndex);

  return NextResponse.json({
    ok: true,
    perSubaccount,
    pulledUnique: records.length,
    customersIndexTotal: total,
  });
}
