// POST /api/portal/disputes — partner submits an attribution dispute from
// the portal, scoped to themselves. Enforces the 14-day window using the
// AUTHORITATIVE server-side value when a conversion is referenced.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { put } from "@vercel/blob";
import { db } from "@/lib/db";
import { partnerDisputes, partnerConversions } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { getPartnerSession, getImpersonation } from "@/lib/partners/session";
import { disputeWithinWindow } from "@/lib/partners/rules";

export const dynamic = "force-dynamic";

const schema = z.object({
  conversionId: z.string().uuid().optional().nullable(),
  dealCloseDate: z.string().datetime(),
  evidence: z.string().min(1).max(5000),
});

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED_ATTACHMENT_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
]);

export async function POST(request: NextRequest) {
  const partner = await getPartnerSession();
  if (!partner) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (await getImpersonation()) {
    return NextResponse.json(
      { error: "Read-only while viewing as an affiliate." },
      { status: 403 },
    );
  }

  // Multipart: a JSON `payload` field + an optional `file` attachment.
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Expected multipart/form-data." },
      { status: 400 },
    );
  }
  const payloadRaw = formData.get("payload");
  let body;
  try {
    body = schema.parse(
      JSON.parse(typeof payloadRaw === "string" ? payloadRaw : "{}"),
    );
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", issues: err.issues },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  // Optional evidence attachment.
  let evidenceFileUrl: string | null = null;
  let evidenceFileName: string | null = null;
  const file = formData.get("file");
  if (file instanceof File && file.size > 0) {
    if (!ALLOWED_ATTACHMENT_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: "Attachment must be a PDF or image (PNG, JPG, WebP)." },
        { status: 400 },
      );
    }
    if (file.size > MAX_ATTACHMENT_BYTES) {
      return NextResponse.json(
        { error: "Attachment must be 10MB or smaller." },
        { status: 400 },
      );
    }
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (token) {
      try {
        const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
        const blob = await put(
          `dispute-evidence/${crypto.randomUUID()}.${ext}`,
          file,
          { access: "public", addRandomSuffix: false, token },
        );
        evidenceFileUrl = blob.url;
        evidenceFileName = file.name;
      } catch (err) {
        console.error("[portal/disputes] attachment upload failed:", err);
        return NextResponse.json(
          { error: "Couldn't upload your attachment. Please try again." },
          { status: 500 },
        );
      }
    }
  }

  const now = new Date();
  // Stored close date. For conversion-anchored disputes we trust the ingested
  // purchase date, never the client-supplied value.
  let dealClose = new Date(body.dealCloseDate);

  if (body.conversionId) {
    const [conv] = await db
      .select({
        id: partnerConversions.id,
        partnerId: partnerConversions.partnerId,
        purchasedAt: partnerConversions.purchasedAt,
        disputeWindowEndsAt: partnerConversions.disputeWindowEndsAt,
      })
      .from(partnerConversions)
      .where(eq(partnerConversions.id, body.conversionId))
      .limit(1);

    // Positive ownership: a referenced conversion must be THIS partner's own.
    // This blocks both another partner's rows AND unmatched (NULL-partner) rows
    // — a partner who believes an uncredited deal is theirs files without a
    // conversionId and describes it in the evidence instead.
    if (!conv || conv.partnerId !== partner.id) {
      return NextResponse.json(
        { error: "That conversion isn't associated with your account." },
        { status: 403 },
      );
    }

    // Enforce the 14-day window from the AUTHORITATIVE server-side value
    // (purchased_at + 14d), not the attacker-controllable request body.
    if (conv.disputeWindowEndsAt && now > conv.disputeWindowEndsAt) {
      return NextResponse.json(
        { error: "The 14-day dispute window for that conversion has passed." },
        { status: 422 },
      );
    }
    // Anchor the stored close date to the real purchase date.
    dealClose = conv.purchasedAt ?? dealClose;

    // Avoid duplicate open disputes for the same conversion by this partner.
    const [dupe] = await db
      .select({ id: partnerDisputes.id })
      .from(partnerDisputes)
      .where(
        and(
          eq(partnerDisputes.partnerId, partner.id),
          eq(partnerDisputes.conversionId, body.conversionId),
          eq(partnerDisputes.status, "open"),
        ),
      )
      .limit(1);
    if (dupe) {
      return NextResponse.json(
        { error: "You already have an open dispute for that conversion." },
        { status: 409 },
      );
    }
  } else {
    // No conversion reference — soft-enforce against the supplied close date so
    // a partner can't file on a deal they themselves report as long closed.
    if (!disputeWithinWindow(dealClose, now)) {
      return NextResponse.json(
        { error: "The 14-day dispute window (from the deal close date) has passed." },
        { status: 422 },
      );
    }
  }

  const [created] = await db
    .insert(partnerDisputes)
    .values({
      partnerId: partner.id,
      conversionId: body.conversionId ?? null,
      dealCloseDate: dealClose,
      evidence: body.evidence.trim(),
      evidenceFileUrl,
      evidenceFileName,
      status: "open",
    })
    .returning();

  return NextResponse.json({ dispute: created }, { status: 201 });
}
