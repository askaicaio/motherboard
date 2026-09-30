// GET  /api/automations/version-status — read every stored override
//      ({ overrides: { "<href>": "<status>", ... } }).
// POST /api/automations/version-status — set one ({ href, status }), where
//      `status: null` clears it back to what the registry derives.
//
// State lives in app_settings (no migration) and is shared app-wide, the same
// approach as the Feature Integration checklist next door. Both the href and
// the status are validated against the registry before anything is stored, so
// the blob can only ever hold real routes and pickable states.
//
// 🛑 `live` IS NOT ACCEPTED HERE, and that is enforced server-side rather than
// only hidden in the menu: it means "this row is the live page", which is a
// fact about routing. See EDITABLE_VERSION_STATUSES in `versions.ts`.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getOptionalAuth } from "@/lib/auth/guard";
import {
  getVersionStatusOverrides,
  isEditableStatus,
  isVersionHref,
  setVersionStatusOverride,
} from "@/lib/automations/version-status";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getOptionalAuth();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const overrides = await getVersionStatusOverrides();
  return NextResponse.json({ overrides });
}

const postSchema = z.object({
  href: z.string().refine(isVersionHref, "Unknown design version"),
  // null clears the override; anything else must be a pickable status.
  status: z
    .string()
    .refine(isEditableStatus, "Status cannot be set to that")
    .nullable(),
});

export async function POST(request: NextRequest) {
  const user = await getOptionalAuth();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

  const overrides = await setVersionStatusOverride(
    body.href,
    body.status,
    user.id,
  );
  return NextResponse.json({ ok: true, overrides });
}
