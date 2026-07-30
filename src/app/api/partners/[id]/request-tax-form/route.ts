// POST /api/partners/[id]/request-tax-form — ask an affiliate to submit (or
// re-submit) their W-9/W-8BEN. Sends a templated message BOTH into the
// affiliate chat (as "CAIO Team") AND by email. Admin only.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { partnerMessages, partners } from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/guard";
import { sendEmail } from "@/lib/email/sender";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

const schema = z.object({ mode: z.enum(["request", "redo"]) });

const PORTAL_TAX_URL = "https://affiliates.chiefaiofficer.com/portal/payouts";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const me = await requireRole("admin");
  const { id } = await params;

  let body;
  try {
    body = schema.parse(await request.json());
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", issues: err.issues },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const [partner] = await db
    .select({ id: partners.id, name: partners.name, email: partners.email })
    .from(partners)
    .where(eq(partners.id, id))
    .limit(1);
  if (!partner) {
    return NextResponse.json({ error: "Partner not found" }, { status: 404 });
  }

  const firstName = partner.name.trim().split(/\s+/)[0] || partner.name;
  const isRedo = body.mode === "redo";

  const chatBody = isRedo
    ? `Hi ${firstName} — we need you to re-submit your tax form. The W-9 / W-8BEN currently on file needs to be replaced. Please upload a fresh PDF in your portal under Payouts → Tax form document. We can't release payouts until it's updated. Thanks!`
    : `Hi ${firstName} — before we can release your affiliate commissions we need your tax form on file: a W-9 (US taxpayers) or W-8BEN (outside the US). Please upload it in your portal under Payouts → Tax form document. Thanks!`;

  // 1) Chat message from "CAIO Team".
  await db.insert(partnerMessages).values({
    partnerId: partner.id,
    senderType: "admin",
    authorAdminId: me.id,
    authorName: me.name ?? null,
    displayAs: "caio_team",
    body: chatBody,
    readByAdminAt: new Date(),
  });

  // 2) Email (best-effort — a mail failure never fails the chat message).
  const subject = isRedo
    ? "Action needed: please re-submit your CAIO affiliate tax form"
    : "Action needed: your CAIO affiliate tax form";
  const html = `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.6;color:#1e1b4b">
    <p>Hi ${firstName},</p>
    <p>${chatBody.replace(`Hi ${firstName} — `, "")}</p>
    <p><a href="${PORTAL_TAX_URL}" style="color:#4f46e5;font-weight:600">Upload your tax form →</a></p>
    <p style="color:#64748b">— The CAIO Team</p>
  </div>`;
  const plain = `Hi ${firstName},\n\n${chatBody}\n\nUpload it here: ${PORTAL_TAX_URL}\n\n— The CAIO Team`;
  await sendEmail({ to: partner.email, subject, html, plain });

  return NextResponse.json({ ok: true });
}
