// POST /api/partners/apply — public, no auth required
// Parses multipart/form-data (tax-form PDF + JSON payload), uploads the PDF to
// Vercel Blob, creates an "applied" partner row, and sends confirmation emails.

import { NextRequest, NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { put } from "@vercel/blob";
import { db } from "@/lib/db";
import { partners } from "@/lib/db/schema";
import { sendTemplatedEmail } from "@/lib/email/render";
import { standardTaxFormName } from "@/lib/partners/tax";
import { notifyProgramEvent } from "@/lib/notifications/notify";

export const maxDuration = 60;

const MAX_FILE_BYTES = 10 * 1024 * 1024; // ~10MB

// Stricter than a bare .email() — require a real domain with a dot + TLD so
// typos like "you@gmailcom" (missing the period) are rejected server-side too.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

const applySchema = z.object({
  firstName: z.string().min(1).max(150),
  lastName: z.string().min(1).max(150),
  email: z
    .string()
    .max(300)
    .transform((v) => v.trim())
    .refine((v) => EMAIL_RE.test(v), "A valid email address is required"),
  address: z.string().min(1).max(500),
  city: z.string().min(1).max(200),
  state: z.string().min(1).max(200),
  postalCode: z.string().min(1).max(50),
  country: z.string().min(1).max(200),
  // Derived client-side from country (US → w9, Canada → w8ben). Optional so
  // older/other clients still validate; defaults to "none" in the insert.
  taxFormStatus: z.enum(["w9", "w8ben", "w8bene"]).optional(),
  dateOfBirth: z.string().min(1).max(20),
  howDidYouHear: z.string().min(1).max(200),
  website: z.string().max(2000).optional().default(""),
  profession: z.string().min(1).max(5000),
  promoExperience: z.boolean(),
  promoExperienceDesc: z.string().max(5000).optional().default(""),
  affiliateExperienceLevel: z.string().min(1).max(50),
  aiExperienceLevel: z.string().min(1).max(50),
  // Items can carry a free-text "Other: …" value, so allow a little room.
  platforms: z.array(z.string().max(200)).min(1),
  audienceSize: z.coerce.number().int().min(0),
  targetAudience: z.array(z.string().max(200)).min(1),
  homeRun: z.string().min(1).max(5000),
  // Optional — applicants shouldn't be blocked by this one.
  anythingElse: z.string().max(5000).optional().default(""),
  signature: z.string().min(1).max(300),
  hp_confirm: z.boolean().optional().default(false), // honeypot checkbox
  elapsedMs: z.number().nullable().optional(), // time trap
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

  // --- Honeypot: silently drop bots (but LOG it — so a false positive is
  // traceable instead of vanishing). The trap is a hidden checkbox, which
  // autofill never ticks. ---
  if (body.hp_confirm) {
    console.warn(
      `[partners/apply] honeypot triggered — dropped submission for "${body.email}" (${body.firstName} ${body.lastName}).`,
    );
    return NextResponse.json({ ok: true });
  }

  // --- Time trap: no human fills this form + picks a PDF in under 2s. Catches
  // fast automated bots that skip the honeypot checkbox. Never false-positives
  // a real applicant (they take far longer). Skipped if elapsedMs is absent. ---
  if (typeof body.elapsedMs === "number" && body.elapsedMs < 2000) {
    console.warn(
      `[partners/apply] time-trap triggered (${body.elapsedMs}ms) — dropped submission for "${body.email}".`,
    );
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
        // W-9 / W-8BEN derived from country on the apply form (defaults to
        // "none" for older clients that don't send it).
        taxFormStatus: body.taxFormStatus ?? "none",
        dateOfBirth: body.dateOfBirth,
        audienceSize: body.audienceSize,
        taxFormUrl,
        // Standardized download name: LASTNAME_FIRSTNAME_YYYY-MM-DD_TAX-FORM.pdf
        taxFormName: standardTaxFormName(body.firstName, body.lastName),
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

  const reviewLink = `${process.env.NEXT_PUBLIC_APP_URL ?? "https://chiefaiofficer.com"}/partner-program/applications`;

  // (a) Confirmation to the applicant — best-effort (sendTemplatedEmail never throws).
  await sendTemplatedEmail("application_received", email, {
    firstName: body.firstName,
  });

  // (b) Admin notification — best-effort.
  await sendTemplatedEmail("new_application", adminAddress, {
    name,
    email,
    location: `${body.city}, ${body.state}, ${body.country}`,
    howHeard: body.howDidYouHear,
    audienceSize: String(body.audienceSize),
    taxLink,
    reviewLink,
  });

  // (c) In-app / email notification to subscribed staff — best-effort.
  await notifyProgramEvent({
    type: "application",
    title: `New affiliate application: ${name}`,
    body: `${body.city}, ${body.state}, ${body.country} · heard via ${body.howDidYouHear}`,
    linkHref: "/partner-program/applications",
  });

  return NextResponse.json({ ok: true });
}
