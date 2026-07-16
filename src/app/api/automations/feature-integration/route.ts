// GET  /api/automations/feature-integration — read the whole checklist state
//      ({ state: { "<table>:<row>:<slug>": true, ... } }).
// POST /api/automations/feature-integration — set one cell ({ key, value }).
//
// State lives in app_settings (no migration) and is shared app-wide. The cell
// key is validated against the checklist spec before it's stored.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getOptionalAuth } from "@/lib/auth/guard";
import {
  getFeatureIntegrationMap,
  setFeatureIntegrationCell,
} from "@/lib/automations/feature-integration";
import { isValidCellKey } from "@/lib/automations/feature-integration-spec";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getOptionalAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const state = await getFeatureIntegrationMap();
  return NextResponse.json({ state });
}

const postSchema = z.object({
  key: z.string().refine(isValidCellKey, "Unknown checklist cell"),
  value: z.boolean(),
});

export async function POST(request: NextRequest) {
  const user = await getOptionalAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body;
  try {
    body = postSchema.parse(await request.json());
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", issues: err.issues },
        { status: 400 },
      );
    }
    throw err;
  }

  const state = await setFeatureIntegrationCell(body.key, body.value, user.id);
  return NextResponse.json({ ok: true, state });
}
