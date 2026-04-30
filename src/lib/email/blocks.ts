// =============================================================
// Email Template — Conditional Content Blocks
// =============================================================

export interface BlockCondition {
  toolKey?: string;
  toolStatus?: "success" | "manual_required";
  division?: string;
  department?: string;
  custom?: (context: EmailContext) => boolean;
}

export interface EmailBlock {
  id: string;
  label: string;
  condition: BlockCondition;
  template: string;
}

export interface EmailContext {
  employee: {
    name: string;
    preferredName?: string;
    email: string;
    jobTitle: string;
    department: string;
    division: string;
    startDate: string;
    managerName?: string;
  };
  provisionedTools: Array<{
    toolKey: string;
    displayName: string;
    status: string;
    config?: Record<string, unknown>;
    resultData?: Record<string, unknown>;
  }>;
  companyName: string;
  supportEmail: string;
}

export const DEFAULT_BLOCKS: EmailBlock[] = [
  {
    id: "welcome_header",
    label: "Welcome Header",
    condition: {},
    template: `<div style="margin-bottom:24px;">
  <h1 style="color:#18181b;font-size:24px;margin:0 0 8px;">Welcome to {{companyName}}, {{employee.preferredName}}!</h1>
  <p style="color:#52525b;margin:0;">We're excited to have you join us as <strong>{{employee.jobTitle}}</strong> in the <strong>{{employee.department}}</strong> department. Your start date is <strong>{{employee.startDate}}</strong>.</p>
</div>`,
  },
  {
    id: "google_workspace",
    label: "Google Workspace Account",
    condition: { toolKey: "google_workspace", toolStatus: "success" },
    template: `<div style="margin-bottom:20px;padding:16px;background:#f4f4f5;border-radius:8px;">
  <h2 style="color:#18181b;font-size:16px;margin:0 0 8px;">Google Workspace</h2>
  <p style="color:#52525b;margin:0;">Your work email is <strong>{{tool.resultData.email}}</strong>. You'll receive a password reset link separately. Use this email to sign in to all company tools.</p>
</div>`,
  },
  {
    id: "slack",
    label: "Slack Access",
    condition: { toolKey: "slack", toolStatus: "success" },
    template: `<div style="margin-bottom:20px;padding:16px;background:#f4f4f5;border-radius:8px;">
  <h2 style="color:#18181b;font-size:16px;margin:0 0 8px;">Slack</h2>
  <p style="color:#52525b;margin:0;">You've been added to our Slack workspace and joined these channels: <strong>{{tool.config.channels}}</strong>. Download Slack at <strong>slack.com/downloads</strong> and sign in with your work email.</p>
</div>`,
  },
  {
    id: "clickup",
    label: "ClickUp Access",
    condition: { toolKey: "clickup", toolStatus: "success" },
    template: `<div style="margin-bottom:20px;padding:16px;background:#f4f4f5;border-radius:8px;">
  <h2 style="color:#18181b;font-size:16px;margin:0 0 8px;">ClickUp</h2>
  <p style="color:#52525b;margin:0;">You've been invited to our ClickUp workspace. Check your email for the invitation link and sign in with your work email.</p>
</div>`,
  },
  {
    id: "gohighlevel",
    label: "GoHighLevel Access",
    condition: { toolKey: "gohighlevel", toolStatus: "success" },
    template: `<div style="margin-bottom:20px;padding:16px;background:#f4f4f5;border-radius:8px;">
  <h2 style="color:#18181b;font-size:16px;margin:0 0 8px;">GoHighLevel</h2>
  <p style="color:#52525b;margin:0;">Your GoHighLevel account has been set up. You'll receive a separate invitation email with login details.</p>
</div>`,
  },
  {
    id: "circle",
    label: "Circle Community",
    condition: { toolKey: "circle", toolStatus: "success" },
    template: `<div style="margin-bottom:20px;padding:16px;background:#f4f4f5;border-radius:8px;">
  <h2 style="color:#18181b;font-size:16px;margin:0 0 8px;">Circle Community</h2>
  <p style="color:#52525b;margin:0;">You've been added to our Circle community. Check your email for the invitation to join.</p>
</div>`,
  },
  {
    id: "onepassword",
    label: "1Password Setup",
    condition: { toolKey: "onepassword" },
    template: `<div style="margin-bottom:20px;padding:16px;background:#fef3c7;border-radius:8px;">
  <h2 style="color:#92400e;font-size:16px;margin:0 0 8px;">1Password — Action Required</h2>
  <p style="color:#78350f;margin:0;"><strong>Important:</strong> You'll receive a 1Password invite email. You must accept this invite before shared vaults can be made available to you. Please do this within 24 hours of receiving the invite.</p>
</div>`,
  },
  {
    id: "fathom_access",
    label: "Fathom Access Instructions",
    condition: {
      custom: (ctx) =>
        ctx.provisionedTools.some(
          (t) =>
            t.toolKey === "onepassword" &&
            (t.status === "success" || t.status === "manual_required")
        ),
    },
    template: `<div style="margin-bottom:20px;padding:16px;background:#f4f4f5;border-radius:8px;">
  <h2 style="color:#18181b;font-size:16px;margin:0 0 8px;">Fathom (Meeting Notes)</h2>
  <p style="color:#52525b;margin:0;">Fathom is accessed by signing into <strong>teams@chiefaiofficer.com</strong> via Google. Use the credentials from the <strong>Moderators vault</strong> in 1Password (once your 1Password invite is accepted).</p>
</div>`,
  },
  {
    id: "manual_action_notice",
    label: "Manual Steps Required",
    condition: {
      custom: (ctx) =>
        ctx.provisionedTools.some((t) => t.status === "manual_required"),
    },
    template: `<div style="margin-bottom:20px;padding:16px;background:#fee2e2;border-radius:8px;">
  <h2 style="color:#991b1b;font-size:16px;margin:0 0 8px;">Pending Manual Setup</h2>
  <p style="color:#7f1d1d;margin:0;">Some of your accounts require manual setup by our IT team. We'll reach out within 1 business day to complete the remaining steps.</p>
</div>`,
  },
  {
    id: "manager_intro",
    label: "Manager Introduction",
    condition: { custom: (ctx) => !!ctx.employee.managerName },
    template: `<div style="margin-bottom:20px;">
  <p style="color:#52525b;">Your manager, <strong>{{employee.managerName}}</strong>, will be in touch before your first day to walk you through the team's workflow and expectations.</p>
</div>`,
  },
  {
    id: "footer",
    label: "Footer / Support",
    condition: {},
    template: `<div style="margin-top:32px;padding-top:16px;border-top:1px solid #e4e4e7;">
  <p style="color:#71717a;font-size:14px;margin:0;">If you have any questions or run into issues accessing any of your tools, reach out to <strong>{{supportEmail}}</strong>.</p>
  <p style="color:#a1a1aa;font-size:12px;margin:12px 0 0;">— The {{companyName}} Team</p>
</div>`,
  },
];
