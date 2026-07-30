// =============================================================
// Affiliate-facing tax-form DOCUMENT management (self-scoped)
// =============================================================
//   GET    — download THIS partner's W-9/W-8BEN PDF
//   POST    — upload / replace it (multipart, PDF ≤10MB)
//   DELETE  — remove it
//
// Tax forms are sensitive, so the file lives in the PRIVATE blob store
// (TAX_BLOB_READ_WRITE_TOKEN) with only the pathname persisted; it's reachable
// only through an authenticated server route like this one. Falls back to the
// public store when the private token isn't configured (mirrors the apply
// route). Scoped to the logged-in partner — never an [id] param. Writes are
// blocked while a staff member is impersonating ("view as").
// =============================================================

import { NextRequest, NextResponse } from "next/server";
import { get, put, del } from "@vercel/blob";
import { db } from "@/lib/db";
import { partners } from "@/lib/db/schema";
import { getPartnerSession, getImpersonation } from "@/lib/partners/session";
import { standardTaxFormName } from "@/lib/partners/tax";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_BYTES = 10 * 1024 * 1024;

/** Delete a stored tax blob, choosing the right token by URL vs pathname. */
async function deleteTaxBlob(value: string) {
  try {
    if (/^https?:\/\//i.test(value)) {
      await del(value); // legacy public blob → default public token
    } else {
      const token = process.env.TAX_BLOB_READ_WRITE_TOKEN;
      if (token) await del(value, { token });
    }
  } catch (err) {
    console.error("[portal/tax-form/file] blob delete failed:", err);
    // best-effort — orphan cleanup never blocks the response
  }
}

// ---- GET: download the current file --------------------------------------
export async function GET() {
  const partner = await getPartnerSession();
  if (!partner) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const value = partner.taxFormUrl;
  if (!value) {
    return NextResponse.json({ error: "No tax form on file." }, { status: 404 });
  }

  // Legacy/public blobs were stored as a full URL — forward to it.
  if (/^https?:\/\//i.test(value)) {
    return NextResponse.redirect(value);
  }

  const token = process.env.TAX_BLOB_READ_WRITE_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: "Tax-form storage isn't configured. Please contact us." },
      { status: 503 },
    );
  }

  try {
    const result = await get(value, { access: "private", token });
    if (!result || !result.stream) {
      return NextResponse.json({ error: "File not found." }, { status: 404 });
    }
    const filename = (partner.taxFormName || "tax-form.pdf").replace(
      /["\r\n]/g,
      "",
    );
    return new Response(result.stream, {
      headers: {
        "Content-Type": "application/pdf",
        // attachment → the browser downloads it rather than previewing inline.
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    console.error("[portal/tax-form/file] download failed:", err);
    return NextResponse.json({ error: "Could not load the file." }, { status: 500 });
  }
}

// ---- POST: upload / replace ----------------------------------------------
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

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Expected multipart/form-data." },
      { status: 400 },
    );
  }
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Please choose a PDF to upload." }, { status: 400 });
  }
  if (file.type !== "application/pdf") {
    return NextResponse.json({ error: "Your tax form must be a PDF." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "Your tax form must be 10MB or smaller." },
      { status: 400 },
    );
  }

  // Fail CLOSED for tax documents (they carry SSN/EIN): never fall back to a
  // world-readable public blob. If the private store isn't configured, refuse
  // the upload rather than store sensitive PII at an unauthenticated URL.
  const taxToken = process.env.TAX_BLOB_READ_WRITE_TOKEN;
  if (!taxToken) {
    return NextResponse.json(
      { error: "Tax-form storage isn't configured yet. Please contact us." },
      { status: 503 },
    );
  }
  const pathname = `tax-forms/${crypto.randomUUID()}.pdf`;
  try {
    await put(pathname, file, {
      access: "private",
      addRandomSuffix: false,
      contentType: "application/pdf",
      token: taxToken,
    });
  } catch (err) {
    console.error("[portal/tax-form/file] upload failed:", err);
    return NextResponse.json(
      { error: "Failed to upload your tax form. Please try again." },
      { status: 500 },
    );
  }
  const newValue = pathname; // private — store only the pathname

  // Standardized download name (LASTNAME_FIRSTNAME_YYYY-MM-DD_TAX-FORM.pdf),
  // derived from the partner's name (best-effort split).
  const nameParts = partner.name.trim().split(/\s+/);
  const firstName = nameParts[0] || partner.name;
  const lastName = nameParts.slice(1).join(" ") || nameParts[0] || partner.name;
  const standardName = standardTaxFormName(firstName, lastName);

  const previous = partner.taxFormUrl;
  await db
    .update(partners)
    .set({ taxFormUrl: newValue, taxFormName: standardName, updatedAt: new Date() })
    .where(eq(partners.id, partner.id));

  // Clean up the superseded file after the row points at the new one.
  if (previous && previous !== newValue) await deleteTaxBlob(previous);

  return NextResponse.json({ ok: true, fileName: standardName });
}

// ---- DELETE: remove the file ---------------------------------------------
export async function DELETE() {
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

  const value = partner.taxFormUrl;
  if (!value) {
    return NextResponse.json({ ok: true }); // already absent — idempotent
  }

  // Removing the document also clears the declared status, so payout gating +
  // the finance CSV never show a valid W-9/W-8BEN with no file behind it.
  await db
    .update(partners)
    .set({
      taxFormUrl: null,
      taxFormName: null,
      taxFormStatus: "none",
      updatedAt: new Date(),
    })
    .where(eq(partners.id, partner.id));

  await deleteTaxBlob(value);

  return NextResponse.json({ ok: true });
}
