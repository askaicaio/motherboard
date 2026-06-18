// POST /api/automations/sync — refresh a platform's automations from its
// source (currently Make only). Triggered by the "Refresh List" button.
//
// Body: { platform: string }
// On success returns the freshly-synced rows (so the client can replace its
// table) plus the sync counts. Platforms without a sync yet return 400 with
// a clear message.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getOptionalAuth } from "@/lib/auth/guard";
import { isSyncablePlatform } from "@/lib/automations/sites";
import { syncMakeAutomations, getMakeRows } from "@/lib/integrations/make-sync";
import { syncN8nAutomations, getN8nRows } from "@/lib/integrations/n8n-sync";
import {
  syncGhlAutomations,
  getGhlRows,
} from "@/lib/integrations/ghl-automations-sync";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const bodySchema = z.object({ platform: z.string() });

export async function POST(request: NextRequest) {
  const user = await getOptionalAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body;
  try {
    body = bodySchema.parse(await request.json());
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", issues: err.issues },
        { status: 400 },
      );
    }
    throw err;
  }

  const { platform } = body;

  if (!isSyncablePlatform(platform)) {
    return NextResponse.json(
      { error: `Live syncing isn't set up for ${platform} yet.` },
      { status: 400 },
    );
  }

  // Dispatch to the platform's sync engine; add a branch here as each lands.
  try {
    if (platform === "n8n") {
      const result = await syncN8nAutomations(user.id);
      const rows = await getN8nRows();
      return NextResponse.json({ ok: true, result, rows });
    }
    if (platform === "ghl" || platform === "ghl-b2b") {
      const result = await syncGhlAutomations(platform, user.id);
      const rows = await getGhlRows(platform);
      return NextResponse.json({ ok: true, result, rows });
    }
    // Default: Make.
    const result = await syncMakeAutomations(user.id);
    const rows = await getMakeRows();
    return NextResponse.json({ ok: true, result, rows });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[${platform} sync] failed:`, message);
    return NextResponse.json({ error: message.slice(0, 500) }, { status: 502 });
  }
}
