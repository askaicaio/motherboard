// GET /api/partners/payouts/preview — who would be paid right now (read-only)
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/guard";
import { previewPayout } from "@/lib/partners/payouts";

export const dynamic = "force-dynamic";

export async function GET() {
  await requireRole("admin");
  const preview = await previewPayout();
  return NextResponse.json(preview);
}
