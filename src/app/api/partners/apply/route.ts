// POST /api/partners/apply — public, no auth required
// Parses multipart/form-data (tax-form PDF + JSON payload), uploads the PDF to
// Vercel Blob, creates an "applied" partner row, and sends confirmation emails.

import { NextRequest, NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { put } from "@vercel/blob";
import { db } from "@/lib/db";
import { partners } from "@/lib/db/schema";
import { sendEmail } from "@/lib/email/sender";
import { renderBrandedEmail, emailButton } from "@/lib/email/template";

export const maxDuration = 60;

const MAX_FILE_BYTES = 10 * 1024 * 1024; // ~10MB

const applySchema = z.object({
  firstName: z.string().min(1).max(150),
  lastName: z.string().min(1).max(150),
  email: z.string().email().max(300),
  address: z.string().min(1).max(500),
  city: z.string().min(1).max(200),
  state: z.string().min(1).max(200),
  postalCode: z.string().min(1).max(50),
  country: z.string().min(1).max(200),
  dateOfBirth: z.string().min(1).max(20),
  howDidYouHear: z.string().min(1).max(200),
  website: z.string().max(1000).optional().default(""),
  profession: z.string().min(1).max(5000),
  promoExperience: z.boolean(),
  promoExperienceDesc: z.string().max(5000).optional().default(""),
  affiliateExperienceLevel: z.string().min(1).max(50),
  aiExperienceLevel: z.string().min(1).max(50),
  platforms: z.array(z.string().max(100)).min(1),
  audienceSize: z.coerce.number().int().min(0),
  targetAudience: z.array(z.string().max(100)).min(1),
  homeRun: z.string().min(1).max(5000),
  anythingElse: z.string().min(1).max(5000),
  signature: z.string().min(1).max(300),
  company_website: z.string().optional().default(""), // honeypot
});

export async function POST(request: NextRequest) {
  // --- Parse multipart form-data ---
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Invalid request. Expected multipart/form-data." },
      { status: 400 },
    );
  }

  const payloadRaw = formData.get("payload");
  if (typeof payloadRaw !== "string") {
    return NextResponse.json(
      { error: "Missing application payload." },
      { status: 400 },
    );
  }

  let body: z.infer<typeof applySchema>;
  try {
    body = applySchema.parse(JSON.parse(payloadRaw));
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: "Validation failed", issues: err.issues },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: "Invalid application payload." },
      { status: 400 },
    );
  }

  // --- Honeypot: silently drop bots ---
  if (body.company_website && body.company_website.trim() !== "") {
    return NextResponse.json({ ok: true });
  }

  // --- Validate the tax-form file ---
  const file = formData.get("taxForm");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json(
      { error: "A W-9 or W-8BEN tax form (PDF) is required." },
      { status: 400 },
    );
  }
  if (file.type !== "application/pdf") {
    return NextResponse.json(
      { error: "Your tax form must be a PDF file." },
      { status: 400 },
    );
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json(
      { error: "Your tax form must be 10MB or smaller." },
      { status: 400 },
    );
  }

  const email = body.email.toLowerCase();
  const name = `${body.firstName} ${body.lastName}`.trim();

  // --- Upload the W-9/W-8BEN PDF ---
  // Tax forms are sensitive. Prefer the PRIVATE blob store
  // (TAX_BLOB_READ_WRITE_TOKEN): we store only the pathname and serve it
  // exclusively through the admin-gated /api/partners/[id]/tax-form route.
  // Falls back to the public store if the private token isn't configured yet.
  const taxToken = process.env.TAX_BLOB_READ_WRITE_TOKEN;
  const taxPathname = `tax-forms/${crypto.randomUUID()}.pdf`;
  let taxFormUrl: string;
  try {
    if (taxToken) {
      await put(taxPathname, file, {
        access: "private",
        addRandomSuffix: false,
        contentType: "application/pdf",
        token: taxToken,
      });
      taxFormUrl = taxPathname; // pathname — not publicly reachable
    } else {
      const blob = await put(taxPathname, file, {
        access: "public",
        addRandomSuffix: false,
        contentType: "application/pdf",
      });
      taxFormUrl = blob.url;
    }
  } catch (err) {
    console.error("[partners/apply] Blob upload error:", err);
    return NextResponse.json(
      { error: "Failed to upload your tax form. Please try again." },
      { status: 500 },
    );
  }

  const applicationData = {
    howDidYouHear: body.howDidYouHear,
    website: body.website,
    profession: body.profession,
    promoExperience: body.promoExperience,
    promoExperienceDesc: body.promoExperienceDesc,
    affiliateExperienceLevel: body.affiliateExperienceLevel,
    aiExperienceLevel: body.aiExperienceLevel,
    platforms: body.platforms,
    targetAudience: body.targetAudience,
    homeRun: body.homeRun,
    anythingElse: body.anythingElse,
    signature: body.signature,
  };

  // --- Create the partner row ---
  let newPartnerId: string | null = null;
  try {
    const [row] = await db
      .insert(partners)
      .values({
        refCode: `pending_${Date.now()}`,
        name,
        email,
        status: "applied",
        address: body.address,
        city: body.city,
        state: body.state,
        postalCode: body.postalCode,
        country: body.country,
        dateOfBirth: body.dateOfBirth,
        audienceSize: body.audienceSize,
        taxFormUrl,
        taxFormName: file.name,
        applicationData,
      })
      .returning({ id: partners.id });
    newPartnerId = row?.id ?? null;
  } catch (err: unknown) {
    // Postgres unique violation code = 23505 (duplicate email)
    const pgErr = err as { code?: string };
    if (pgErr?.code === "23505") {
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

  const adminAddress = "partners@chiefaiofficer.com";

  // Tax form is served through the admin-gated route (works for private blobs).
  const reviewBase = (
    process.env.NEXT_PUBLIC_APP_URL ?? "https://chiefaiofficer.com"
  ).replace(/\/$/, "");
  const taxLink = newPartnerId
    ? `${reviewBase}/api/partners/${newPartnerId}/tax-form`
    : `${reviewBase}/partner-program/applications`;

  // (a) Confirmation to the applicant
  const applicantContentHtml = `
      <p>Hi ${body.firstName},</p>
      <p>Thank you for applying to the Chief AI Officer Affiliate Program! We review every application personally and will be in touch within 3 business days.</p>
      <p>Here's a quick recap of what to expect:</p>
      <ul>
        <li><strong>10% flat commission</strong> on every closed deal you refer</li>
        <li><strong>60-day cookie window</strong> from first click</li>
        <li><strong>Net-45 payouts</strong> via ACH or Zelle (W-9 / W-8BEN required)</li>
      </ul>
      <p>If you have any questions in the meantime, feel free to reply to this email.</p>
      <p>— The Chief AI Officer Team</p>
    `;
  await sendEmail({
    to: email,
    subject: "We received your Chief AI Officer affiliate application",
    html: renderBrandedEmail({
      heading: "We received your application",
      contentHtml: applicantContentHtml,
      preheader:
        "We review every application personally — expect to hear back within 3 business days.",
    }),
    plain: `Hi ${body.firstName},\n\nThank you for applying to the Chief AI Officer Affiliate Program! We review every application personally and will be in touch within 3 business days.\n\nQuick overview:\n- 10% flat commission on every closed deal\n- 60-day cookie window\n- Net-45 payouts via ACH or Zelle\n\nQuestions? Just reply to this email.\n\n— The Chief AI Officer Team`,
  });

  // (b) Admin notification
  const reviewLink = `${process.env.NEXT_PUBLIC_APP_URL ?? "https://chiefaiofficer.com"}/partner-program/applications`;
  const adminContentHtml = `
      <p>A new affiliate application was submitted.</p>
      <table style="border-collapse:collapse;font-size:14px;">
        <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Name</td><td>${name}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Email</td><td>${email}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Location</td><td>${body.city}, ${body.state}, ${body.country}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Heard via</td><td>${body.howDidYouHear}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Audience size</td><td>${body.audienceSize}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Tax form</td><td><a href="${taxLink}">${file.name}</a></td></tr>
      </table>
      ${emailButton("Review in Motherboard →", reviewLink)}
    `;
  await sendEmail({
    to: adminAddress,
    subject: `New affiliate application: ${name}`,
    html: renderBrandedEmail({
      heading: "New affiliate application",
      contentHtml: adminContentHtml,
      preheader: `${name} just applied to the affiliate program.`,
    }),
    plain: `New affiliate application\n\nName: ${name}\nEmail: ${email}\nLocation: ${body.city}, ${body.state}, ${body.country}\nHeard via: ${body.howDidYouHear}\nAudience size: ${body.audienceSize}\nTax form: ${taxLink}\n\nReview: ${reviewLink}`,
  });

  return NextResponse.json({ ok: true });
}
