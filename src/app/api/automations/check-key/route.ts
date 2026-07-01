// POST /api/automations/check-key — live-verify a platform's API credential.
// Triggered by the Main Page card's status button. Returns { ok: boolean }:
// true only when the platform's token actually authenticates right now. The
// token is read + used server-side; only the boolean reaches the client.
//
// Body: { platform: string }
// Only Make has a live integration today; every other platform returns false.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getOptionalAuth } from "@/lib/auth/guard";
import { verifyPlatform } from "@/lib/automations/verify";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const bodySchema = z.object({ platform: z.string() });

export async function POST(request: NextRequest) {
  const user = await getOptionalAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body;
  try {
    body = bodySchema.parse(await request.json());
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed" }, { status: 400 });
    }
    throw err;
  }

  // Live-verify server-side (platforms with no live integration return false).
  const ok = await verifyPlatform(body.platform);

  return NextResponse.json({ ok });
}
