// POST /api/contact — PUBLIC, no auth required.
// Free-text "Send us a message" support form used by the affiliate / enroll
// marketing pages (replaces the confusing raw mailto: links). Emails the message
// to the support inbox (Dani) via Resend, with the sender's address as reply-to
// so staff can just hit "Reply". Returns { ok:true } on success, 400 on a bad
// body, 502 if the mail provider rejected the send (so the client can toast
// accurately and fall back to a direct email address).

import { NextRequest, NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { sendEmail } from "@/lib/email/sender";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Where support messages land. Overridable via env; defaults to Dani, who owns
// the affiliate program and wants to be the human on the other end.
const SUPPORT_INBOX = process.env.SUPPORT_INBOX_EMAIL || "dani@chiefaiofficer.com";

const schema = z.object({
  name: z.string().trim().min(1).max(150),
  email: z.string().trim().email().max(300),
  message: z.string().trim().min(1).max(5000),
  // A short page label (e.g. "Enroll page") for context in the subject line.
  source: z.string().trim().max(120).optional().default(""),
});

/** Escape user-supplied text before embedding it in the HTML email. */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function POST(request: NextRequest) {
  let body: z.infer<typeof schema>;
  try {
    body = schema.parse(await request.json());
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        {
          ok: false,
          error: "Please enter your name, a valid email, and a message.",
        },
        { status: 400 },
      );
    }
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }

  const tag = body.source ? ` · ${escapeHtml(body.source)}` : "";
  const subject = `Support message from ${body.name}${body.source ? ` (${body.source})` : ""}`;
  const safeName = escapeHtml(body.name);
  const safeEmail = escapeHtml(body.email);
  const safeMsg = escapeHtml(body.message).replace(/\n/g, "<br/>");

  const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;color:#0f172a;">
  <p style="font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#6b7280;margin:0 0 10px;">New support message${tag}</p>
  <p style="font-size:14px;margin:0 0 2px;color:#334155;"><strong>From:</strong> ${safeName} &lt;${safeEmail}&gt;</p>
  <div style="font-size:15px;line-height:1.6;margin-top:14px;padding:14px 16px;background:#f8fafc;border-left:3px solid #4f46e5;border-radius:6px;color:#0f172a;">${safeMsg}</div>
  <p style="font-size:12px;color:#94a3b8;margin-top:16px;">Reply directly to this email to respond to ${safeName}.</p>
</div>`;
  const plain = `New support message${body.source ? ` (${body.source})` : ""}\n\nFrom: ${body.name} <${body.email}>\n\n${body.message}\n\n(Reply to this email to respond.)`;

  const result = await sendEmail({
    to: SUPPORT_INBOX,
    replyTo: body.email,
    subject,
    html,
    plain,
  });

  if (!result.success) {
    console.error("[contact] send failed:", result.error);
    return NextResponse.json(
      {
        ok: false,
        error: "We couldn't send your message right now. Please try again shortly.",
      },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
}
