// Partner Program — Email Templates page (staff, server component).
// For every descriptor in the registry it computes the *resolved* template
// (defaults merged with any DB override) and a fully-rendered preview HTML, then
// hands an array of plain serializable rows to the client component, which lays
// them out with a sticky outline and per-template editing.

import { requireAuth } from "@/lib/auth/guard";
import { EMAIL_TEMPLATES } from "@/lib/email/registry";
import { resolveTemplate, renderTemplate } from "@/lib/email/render";
import {
  EmailTemplatesClient,
  type TemplateRow,
} from "@/components/partner-program/emails-client";

export const dynamic = "force-dynamic";

export default async function EmailTemplatesPage() {
  await requireAuth();

  // The address every transactional email is sent from.
  const fromName = process.env.EMAIL_FROM_NAME || "CAIO Onboarding";
  const fromAddress =
    process.env.EMAIL_FROM_ADDRESS || "onboarding@chiefaiofficer.com";
  const fromLabel = `${fromName} <${fromAddress}>`;

  const templates: TemplateRow[] = await Promise.all(
    EMAIL_TEMPLATES.map(async (descriptor) => {
      // Build a sample vars map from the descriptor's variables.
      const sampleVars: Record<string, string> = {};
      for (const v of descriptor.variables) sampleVars[v.name] = v.sample;

      const resolved = await resolveTemplate(descriptor.key);
      const { previewHtml } = await (async () => {
        const r = await renderTemplate(descriptor.key, sampleVars);
        return { previewHtml: r.html };
      })();

      return {
        key: descriptor.key,
        name: descriptor.name,
        trigger: descriptor.trigger,
        recipient: descriptor.recipient,
        subject: resolved.subject,
        heading: resolved.heading,
        bodyHtml: resolved.bodyHtml,
        previewHtml,
        variables: descriptor.variables,
        overridden: resolved.overridden,
      };
    }),
  );

  return <EmailTemplatesClient fromLabel={fromLabel} templates={templates} />;
}
