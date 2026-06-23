// POST /api/partners/apply — public, no auth required
// Creates a partner application row and sends confirmation emails.

import { NextRequest, NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { db } from "@/lib/db";
import { partners } from "@/lib/db/schema";
import { sendEmail } from "@/lib/email/sender";

const applySchema = z.object({
  name: z.string().min(1).max(300),
  email: z.string().email().max(300),
  company: z.string().max(300).optional(),
  website: z.string().url().max(500).optional(),
  notes: z.string().max(5000).optional(),
});

export async function POST(request: NextRequest) {
  let body: z.infer<typeof applySchema>;
  try {
    body = applySchema.parse(await request.json());
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: "Validation failed", issues: err.issues },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const email = body.email.toLowerCase();

  // Compose notes from website + message
  const noteParts: string[] = [];
  if (body.website) noteParts.push(`Website: ${body.website}`);
  if (body.notes) noteParts.push(body.notes);
  const combinedNotes = noteParts.join("\n\n") || null;

  try {
    await db.insert(partners).values({
      // refCode is required NOT NULL — generate a placeholder that the
      // approve endpoint will replace with a real base62 code.
      refCode: `pending_${Date.now()}`,
      name: body.name,
      email,
      company: body.company ?? null,
      notes: combinedNotes,
      status: "applied",
    });
  } catch (err: unknown) {
    // Postgres unique violation code = 23505
    const pgErr = err as { code?: string };
    if (pgErr?.code === "23505") {
      // Already applied — return a friendly 200 rather than a 500
      return NextResponse.json({
        ok: true,
        alreadyApplied: true,
        message:
          "We already have an application on file for this email address. We'll be in touch soon!",
      });
    }
    console.error("[partners/apply] DB insert error:", err);
    return NextResponse.json(
      { error: "Failed to save application. Please try again." },
      { status: 500 },
    );
  }

  const adminAddress =
    process.env.EMAIL_FROM_ADDRESS || "partners@chiefaiofficer.com";

  // (a) Confirmation to the applicant
  await sendEmail({
    to: email,
    subject: "We received your Chief AI Officer partner application",
    html: `
      <p>Hi ${body.name},</p>
      <p>Thank you for applying to the Chief AI Officer Partner Program! We review every application personally and will be in touch within 3 business days.</p>
      <p>Here's a quick recap of what to expect:</p>
      <ul>
        <li><strong>10% flat commission</strong> on every closed deal you refer</li>
        <li><strong>60-day cookie window</strong> from first click</li>
        <li><strong>Net-45 payouts</strong> via ACH or Zelle (W-9 / W-8BEN required)</li>
      </ul>
      <p>If you have any questions in the meantime, feel free to reply to this email.</p>
      <p>— The Chief AI Officer Team</p>
    `,
    plain: `Hi ${body.name},\n\nThank you for applying to the Chief AI Officer Partner Program! We review every application personally and will be in touch within 3 business days.\n\nQuick overview:\n- 10% flat commission on every closed deal\n- 60-day cookie window\n- Net-45 payouts via ACH or Zelle\n\nQuestions? Just reply to this email.\n\n— The Chief AI Officer Team`,
  });

  // (b) Admin notification
  await sendEmail({
    to: adminAddress,
    subject: `New partner application: ${body.name}`,
    html: `
      <p>A new partner application was submitted.</p>
      <table style="border-collapse:collapse;font-size:14px;">
        <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Name</td><td>${body.name}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Email</td><td>${email}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Company</td><td>${body.company ?? "—"}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Website</td><td>${body.website ?? "—"}</td></tr>
      </table>
      <p><strong>Message:</strong><br/>${body.notes ? body.notes.replace(/\n/g, "<br/>") : "—"}</p>
      <p><a href="${process.env.NEXT_PUBLIC_APP_URL ?? "https://chiefaiofficer.com"}/partner-program/applications">Review in Motherboard →</a></p>
    `,
    plain: `New partner application\n\nName: ${body.name}\nEmail: ${email}\nCompany: ${body.company ?? "—"}\nWebsite: ${body.website ?? "—"}\n\nMessage:\n${body.notes ?? "—"}\n\nReview: ${process.env.NEXT_PUBLIC_APP_URL ?? "https://chiefaiofficer.com"}/partner-program/applications`,
  });

  return NextResponse.json({ ok: true });
}
