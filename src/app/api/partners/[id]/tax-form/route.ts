// GET /api/partners/[id]/tax-form — stream an affiliate's W-9/W-8BEN PDF.
// Admin-only. Private tax blobs are never publicly reachable; this route is the
// single authenticated gateway, fetching the blob server-side with the private
// store token and streaming it back inline. Everything is wrapped so a storage
// hiccup returns a clear message instead of an opaque 500.
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
  try {
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
      return NextResponse.json(
        { error: "No tax form on file for this affiliate." },
        { status: 404 },
      );
    }

    const value = partner.taxFormUrl;

    // Legacy/public blobs were stored as a full URL — forward to it.
    if (/^https?:\/\//i.test(value)) {
      return NextResponse.redirect(value);
    }

    // Private blob (pathname) — needs the private store token.
    const token = process.env.TAX_BLOB_READ_WRITE_TOKEN;
    if (!token) {
      return NextResponse.json(
        {
          error:
            "Tax-form storage isn't configured (TAX_BLOB_READ_WRITE_TOKEN is missing). Connect the private Blob store and redeploy.",
        },
        { status: 503 },
      );
    }

    const result = await get(value, { access: "private", token });
    if (!result || !result.stream) {
      return NextResponse.json(
        { error: "Tax form not found in storage." },
        { status: 404 },
      );
    }

    const filename = (partner.taxFormName || "tax-form.pdf").replace(
      /["\r\n]/g,
      "",
    );
    return new Response(result.stream, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    console.error("[tax-form] failed:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Could not load the tax form: ${message}` },
      { status: 500 },
    );
  }
}
