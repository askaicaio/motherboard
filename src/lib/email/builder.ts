import Handlebars from "handlebars";
import { convert } from "html-to-text";
import { DEFAULT_BLOCKS, type EmailBlock, type EmailContext } from "./blocks";

/**
 * Build the onboarding email from conditional blocks.
 */
export function buildOnboardingEmail(
  context: EmailContext,
  blocks: EmailBlock[] = DEFAULT_BLOCKS
): { subject: string; html: string; plain: string } {
  const activeBlocks = blocks.filter((block) =>
    evaluateCondition(block, context)
  );

  const htmlParts: string[] = [];

  for (const block of activeBlocks) {
    const toolData = context.provisionedTools.find(
      (t) => t.toolKey === block.condition.toolKey
    );

    const templateContext = {
      companyName: context.companyName,
      supportEmail: context.supportEmail,
      employee: {
        ...context.employee,
        preferredName: context.employee.preferredName || context.employee.name,
      },
      tool: toolData || {},
      tools: context.provisionedTools,
    };

    try {
      const compiled = Handlebars.compile(block.template);
      htmlParts.push(compiled(templateContext));
    } catch (err) {
      console.error(`[EMAIL] Failed to render block "${block.id}":`, err);
    }
  }

  const bodyHtml = htmlParts.join("\n");
  const html = wrapInEmailLayout(bodyHtml, context.companyName);
  const plain = convert(html, { wordwrap: 80 });
  const displayName = context.employee.preferredName || context.employee.name;
  const subject = `Welcome to ${context.companyName}, ${displayName}!`;

  return { subject, html, plain };
}

function evaluateCondition(block: EmailBlock, context: EmailContext): boolean {
  const { condition } = block;

  if (condition.toolKey) {
    const tool = context.provisionedTools.find(
      (t) => t.toolKey === condition.toolKey
    );
    if (!tool) return false;
    if (condition.toolStatus && tool.status !== condition.toolStatus) {
      return false;
    }
  }

  if (condition.division && context.employee.division !== condition.division) {
    return false;
  }

  if (condition.department && context.employee.department !== condition.department) {
    return false;
  }

  if (condition.custom && !condition.custom(context)) {
    return false;
  }

  return true;
}

function wrapInEmailLayout(bodyHtml: string, companyName: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Welcome to ${companyName}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:32px 24px;background:#ffffff;">
    ${bodyHtml}
  </div>
</body>
</html>`;
}
