// GET /api/partners/[id]/tax-form — stream an affiliate's W-9/W-8BEN PDF.
// Admin-only. Private tax blobs are never publicly reachable; this route is the
// single authenticated gateway, fetching the blob server-side with the private
// store token and streaming it back inline.
import { NextRequest, NextResponse } from "next/server";
import { get } from "@vercel/blob";
import { db } from "@/lib/db";
import { partners } from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/guard";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireRole("admin");

  const { id } = await params;
  const [partner] = await db
    .select({
      taxFormUrl: partners.taxFormUrl,
      taxFormName: partners.taxFormName,
    })
    .from(partners)
    .where(eq(partners.id, id));

  if (!partner?.taxFormUrl) {
    return NextResponse.json({ error: "No tax form on file." }, { status: 404 });
  }

  // Legacy/public blobs were stored as a full URL — just forward to it.
  if (/^https?:\/\//.test(partner.taxFormUrl)) {
    return NextResponse.redirect(partner.taxFormUrl);
  }

  // Private blob (pathname) — fetch with the private store token and stream.
  const token = process.env.TAX_BLOB_READ_WRITE_TOKEN;
  let result;
  try {
    result = await get(partner.taxFormUrl, { access: "private", token });
  } catch (err) {
    console.error("[tax-form] private blob fetch failed:", err);
    return NextResponse.json(
      { error: "Could not load the tax form." },
      { status: 502 },
    );
  }

  if (!result || !result.stream) {
    return NextResponse.json({ error: "Tax form not found." }, { status: 404 });
  }

  const filename = (partner.taxFormName || "tax-form.pdf").replace(/["\r\n]/g, "");
  return new Response(result.stream, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
