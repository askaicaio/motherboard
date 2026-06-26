// GET/PUT /api/partners/email-templates/[key] — admin-only.
// GET  : returns the descriptor metadata, the code defaults, and the current
//        resolved template (defaults merged with any DB override).
// PUT  : upserts a partner_email_templates row. Each of { subject, heading,
//        bodyHtml } is nullable — null/empty resets that field to its default.
//        Returns the freshly resolved template.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { partnerEmailTemplates } from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/guard";
import { getTemplateDescriptor } from "@/lib/email/registry";
import { resolveTemplate } from "@/lib/email/render";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ key: string }> },
) {
  await requireRole("admin");
  const { key } = await params;

  const descriptor = getTemplateDescriptor(key);
  if (!descriptor) {
    return NextResponse.json(
      { error: "Unknown email template" },
      { status: 404 },
    );
  }

  const current = await resolveTemplate(key);

  return NextResponse.json({
    descriptor: {
      key: descriptor.key,
      name: descriptor.name,
      trigger: descriptor.trigger,
      recipient: descriptor.recipient,
      variables: descriptor.variables,
    },
    defaults: {
      subject: descriptor.defaultSubject,
      heading: descriptor.defaultHeading,
      bodyHtml: descriptor.defaultBodyHtml,
    },
    current,
  });
}

const putSchema = z.object({
  subject: z.string().nullable().optional(),
  heading: z.string().nullable().optional(),
  bodyHtml: z.string().nullable().optional(),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> },
) {
  const user = await requireRole("admin");
  const { key } = await params;

  const descriptor = getTemplateDescriptor(key);
  if (!descriptor) {
    return NextResponse.json(
      { error: "Unknown email template" },
      { status: 404 },
    );
  }

  let body: z.infer<typeof putSchema>;
  try {
    body = putSchema.parse(await request.json());
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", issues: err.issues },
        { status: 400 },
      );
    }
    throw err;
  }

  // Empty string === reset to default (store null). Undefined means "not
  // provided" → also treated as reset for that field on this upsert.
  const norm = (v: string | null | undefined): string | null => {
    if (v == null) return null;
    const trimmed = v.trim();
    return trimmed === "" ? null : v;
  };

  const now = new Date();
  const values = {
    key,
    subject: norm(body.subject),
    heading: norm(body.heading),
    bodyHtml: norm(body.bodyHtml),
    updatedAt: now,
    updatedBy: user.id,
  };

  await db
    .insert(partnerEmailTemplates)
    .values(values)
    .onConflictDoUpdate({
      target: partnerEmailTemplates.key,
      set: {
        subject: values.subject,
        heading: values.heading,
        bodyHtml: values.bodyHtml,
        updatedAt: now,
        updatedBy: user.id,
      },
    });

  const current = await resolveTemplate(key);
  return NextResponse.json({ current });
}
