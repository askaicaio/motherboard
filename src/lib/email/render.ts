// =============================================================
// Email template rendering — merges DB overrides (partner_email_templates) over
// the code defaults in ./registry.ts, interpolates {{var}} tokens, and wraps the
// result in the fixed branded chrome (renderBrandedEmail). This is the single
// path every system email goes through at send time.
// =============================================================

import { db } from "@/lib/db";
import { partnerEmailTemplates } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { renderBrandedEmail } from "@/lib/email/template";
import { getTemplateDescriptor } from "@/lib/email/registry";
import { sendEmail } from "@/lib/email/sender";

/**
 * Replace every {{name}} token in `tpl` with vars[name]. Unknown tokens (no
 * matching key) collapse to an empty string. Whitespace inside the braces is
 * tolerated ({{ name }} works the same as {{name}}).
 */
export function interpolate(
  tpl: string,
  vars: Record<string, string>,
): string {
  return tpl.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_match, name: string) => {
    const v = vars[name];
    return v == null ? "" : v;
  });
}

export interface ResolvedTemplate {
  key: string;
  subject: string;
  heading: string;
  bodyHtml: string;
  overridden: { subject: boolean; heading: boolean; body: boolean };
}

/**
 * Resolve a template by merging any DB override row over the descriptor
 * defaults, field by field. A null/empty override field falls back to the
 * default for that field. Throws if the key isn't a registered template.
 */
export async function resolveTemplate(key: string): Promise<ResolvedTemplate> {
  const descriptor = getTemplateDescriptor(key);
  if (!descriptor) {
    throw new Error(`Unknown email template key: ${key}`);
  }

  let override:
    | { subject: string | null; heading: string | null; bodyHtml: string | null }
    | undefined;
  try {
    [override] = await db
      .select({
        subject: partnerEmailTemplates.subject,
        heading: partnerEmailTemplates.heading,
        bodyHtml: partnerEmailTemplates.bodyHtml,
      })
      .from(partnerEmailTemplates)
      .where(eq(partnerEmailTemplates.key, key))
      .limit(1);
  } catch {
    // If the override table is unavailable for any reason, fall back to defaults
    // rather than failing the send.
    override = undefined;
  }

  const has = (v: string | null | undefined): v is string =>
    typeof v === "string" && v.trim() !== "";

  const subjectOverridden = has(override?.subject);
  const headingOverridden = has(override?.heading);
  const bodyOverridden = has(override?.bodyHtml);

  return {
    key,
    subject: subjectOverridden ? override!.subject! : descriptor.defaultSubject,
    heading: headingOverridden ? override!.heading! : descriptor.defaultHeading,
    bodyHtml: bodyOverridden ? override!.bodyHtml! : descriptor.defaultBodyHtml,
    overridden: {
      subject: subjectOverridden,
      heading: headingOverridden,
      body: bodyOverridden,
    },
  };
}

/** Crude tag-stripper to produce a plain-text fallback from rendered HTML. */
function stripTags(html: string): string {
  return html
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\/\s*(p|div|li|tr|h[1-6]|table)\s*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Resolve a template, interpolate the subject/heading/body with `vars`, wrap
 * the heading+body in the branded chrome, and return subject/html/plain.
 */
export async function renderTemplate(
  key: string,
  vars: Record<string, string>,
): Promise<{ subject: string; html: string; plain: string }> {
  const resolved = await resolveTemplate(key);

  const subject = interpolate(resolved.subject, vars);
  const heading = interpolate(resolved.heading, vars);
  const bodyHtml = interpolate(resolved.bodyHtml, vars);

  const html = renderBrandedEmail({ heading, contentHtml: bodyHtml });
  const plain = stripTags(bodyHtml);

  return { subject, html, plain };
}

/**
 * Render + send a templated email. Best-effort: any failure (unknown key,
 * render error, mail hiccup) is logged and swallowed — it never throws, so a
 * mail problem can't roll back the action that triggered it.
 */
export async function sendTemplatedEmail(
  key: string,
  to: string,
  vars: Record<string, string>,
): Promise<void> {
  try {
    const { subject, html, plain } = await renderTemplate(key, vars);
    await sendEmail({ to, subject, html, plain });
  } catch (err) {
    console.error(`[email] sendTemplatedEmail("${key}") failed:`, err);
  }
}

/**
 * OPTIONAL preview helper. Wraps an already-resolved (and optionally
 * sample-interpolated) heading + body in the branded chrome, returning the
 * full HTML. The subject is intentionally ignored — previews show the body.
 */
export function renderPreview(
  t: { heading: string; bodyHtml: string },
  _subjectIgnored?: unknown,
): string {
  return renderBrandedEmail({ heading: t.heading, contentHtml: t.bodyHtml });
}
