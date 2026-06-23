// =============================================================
// Cron: refresh customers_index from GHL (new-customer gate)
// =============================================================
// Runs daily. Pulls paid buyers from both GHL sub-accounts and upserts
// them into customers_index so the new-customer gate stays current
// without anyone clicking the manual "Pull from GHL" button. Live
// affiliate conversions also extend the index in real time; this catches
// direct (non-affiliate) CAIO purchases. Same CRON_SECRET auth as the
// other crons.
// =============================================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { customersIndex } from "@/lib/db/schema";
import {
  pullGhlBuyers,
  getGhlSubaccountCreds,
} from "@/lib/integrations/ghl-customers";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorized(request: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return process.env.NODE_ENV !== "production";
  return request.headers.get("authorization") === `Bearer ${expected}`;
}

const BATCH = 500;

export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const perSubaccount: Record<string, number> = {};
  const earliest = new Map<string, Date>();

  for (const sub of ["main", "b2b"] as const) {
    const creds = getGhlSubaccountCreds(sub);
    if (!creds) {
      perSubaccount[sub] = -1; // unconfigured — skip, don't fail the run
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
      console.error(`[cron/sync-customers-index] ${sub} failed:`, err);
      perSubaccount[sub] = -2; // errored — keep going with the other sub
    }
  }

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

  return NextResponse.json({ ok: true, perSubaccount, pulledUnique: records.length });
}
