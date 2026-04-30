// =============================================================
// Email Content Engine — Per-Tool Instruction Blocks
// =============================================================
// Each tool registers its own instruction block that gets injected
// into the onboarding email when the tool is provisioned. Blocks
// are conditional on tool status and can include role-specific content.
// =============================================================

import type { EmailBlock, EmailContext } from "./blocks";

/**
 * Tool-specific instruction registry.
 * Each tool can register multiple instruction variants depending on status.
 */
export interface ToolInstructionBlock {
  toolKey: string;
  displayName: string;
  /**
   * Return the email blocks for this tool given the provisioned tool data.
   * Tools can return different blocks based on status, config, or result data.
   */
  getBlocks(toolData: EmailContext["provisionedTools"][number]): EmailBlock[];
}

// ---- Registered Tool Instruction Providers ----

const googleWorkspaceInstructions: ToolInstructionBlock = {
  toolKey: "google_workspace",
  displayName: "Google Workspace",
  getBlocks(tool) {
    if (tool.status === "success") {
      const email = (tool.resultData?.email as string) || tool.config?.email || "your-work-email@chiefaiofficer.com";
      return [{
        id: "google_workspace_success",
        label: "Google Workspace — Active",
        condition: { toolKey: "google_workspace", toolStatus: "success" },
        template: `<div style="margin-bottom:20px;padding:16px;background:#f0fdf4;border-left:4px solid #22c55e;border-radius:8px;">
  <h2 style="color:#18181b;font-size:16px;margin:0 0 8px;">✅ Google Workspace</h2>
  <p style="color:#52525b;margin:0 0 8px;">Your work email is <strong>${email}</strong>.</p>
  <ul style="color:#52525b;margin:0;padding-left:20px;">
    <li>You'll receive a password reset link at your personal email shortly</li>
    <li>Use this email to sign into all company Google services (Gmail, Drive, Calendar, Meet)</li>
    <li>Enable 2-Step Verification in your Google account security settings</li>
  </ul>
</div>`,
      }];
    }

    if (tool.status === "manual_required") {
      return [{
        id: "google_workspace_manual",
        label: "Google Workspace — Pending Setup",
        condition: { toolKey: "google_workspace" },
        template: `<div style="margin-bottom:20px;padding:16px;background:#fef9c3;border-left:4px solid #eab308;border-radius:8px;">
  <h2 style="color:#92400e;font-size:16px;margin:0 0 8px;">⏳ Google Workspace — Setup In Progress</h2>
  <p style="color:#78350f;margin:0;">Your Google Workspace account is being set up manually by our IT team. You'll receive credentials within 1 business day.</p>
</div>`,
      }];
    }

    return [];
  },
};

const slackInstructions: ToolInstructionBlock = {
  toolKey: "slack",
  displayName: "Slack",
  getBlocks(tool) {
    if (tool.status === "success") {
      const channels = (tool.config?.channels as string[])?.join(", ") || "relevant team channels";
      return [{
        id: "slack_success",
        label: "Slack — Active",
        condition: { toolKey: "slack", toolStatus: "success" },
        template: `<div style="margin-bottom:20px;padding:16px;background:#f0fdf4;border-left:4px solid #22c55e;border-radius:8px;">
  <h2 style="color:#18181b;font-size:16px;margin:0 0 8px;">✅ Slack</h2>
  <p style="color:#52525b;margin:0 0 8px;">You've been added to our Slack workspace and joined: <strong>${channels}</strong></p>
  <ul style="color:#52525b;margin:0;padding-left:20px;">
    <li>Download Slack at <strong>slack.com/downloads</strong></li>
    <li>Sign in with your work email</li>
    <li>Say hello in #general when you're set up!</li>
    <li>Set your profile photo and display name</li>
  </ul>
</div>`,
      }];
    }
    return [];
  },
};

const clickupInstructions: ToolInstructionBlock = {
  toolKey: "clickup",
  displayName: "ClickUp",
  getBlocks(tool) {
    if (tool.status === "success") {
      return [{
        id: "clickup_success",
        label: "ClickUp — Active",
        condition: { toolKey: "clickup", toolStatus: "success" },
        template: `<div style="margin-bottom:20px;padding:16px;background:#f0fdf4;border-left:4px solid #22c55e;border-radius:8px;">
  <h2 style="color:#18181b;font-size:16px;margin:0 0 8px;">✅ ClickUp</h2>
  <p style="color:#52525b;margin:0 0 8px;">You've been invited to our ClickUp workspace for project and task management.</p>
  <ul style="color:#52525b;margin:0;padding-left:20px;">
    <li>Check your email for the ClickUp invitation link</li>
    <li>Sign in with your work email (Google SSO)</li>
    <li>Your manager will assign your first tasks</li>
  </ul>
</div>`,
      }];
    }
    return [];
  },
};

const ghlInstructions: ToolInstructionBlock = {
  toolKey: "gohighlevel",
  displayName: "GoHighLevel",
  getBlocks(tool) {
    if (tool.status === "success") {
      return [{
        id: "gohighlevel_success",
        label: "GoHighLevel — Active",
        condition: { toolKey: "gohighlevel", toolStatus: "success" },
        template: `<div style="margin-bottom:20px;padding:16px;background:#f0fdf4;border-left:4px solid #22c55e;border-radius:8px;">
  <h2 style="color:#18181b;font-size:16px;margin:0 0 8px;">✅ GoHighLevel (CRM)</h2>
  <p style="color:#52525b;margin:0 0 8px;">Your GoHighLevel account has been set up for CRM and client management.</p>
  <ul style="color:#52525b;margin:0;padding-left:20px;">
    <li>You'll receive a separate invitation email with login details</li>
    <li>Bookmark <strong>app.gohighlevel.com</strong></li>
    <li>Your team lead will walk you through the CRM workflow</li>
  </ul>
</div>`,
      }];
    }
    return [];
  },
};

const circleInstructions: ToolInstructionBlock = {
  toolKey: "circle",
  displayName: "Circle",
  getBlocks(tool) {
    if (tool.status === "success") {
      return [{
        id: "circle_success",
        label: "Circle — Active",
        condition: { toolKey: "circle", toolStatus: "success" },
        template: `<div style="margin-bottom:20px;padding:16px;background:#f0fdf4;border-left:4px solid #22c55e;border-radius:8px;">
  <h2 style="color:#18181b;font-size:16px;margin:0 0 8px;">✅ Circle Community</h2>
  <p style="color:#52525b;margin:0 0 8px;">You've been added to our Circle community platform.</p>
  <ul style="color:#52525b;margin:0;padding-left:20px;">
    <li>Check your email for the Circle invitation</li>
    <li>Complete your profile with a photo and short bio</li>
    <li>Introduce yourself in the Welcome space</li>
  </ul>
</div>`,
      }];
    }
    return [];
  },
};

const onePasswordInstructions: ToolInstructionBlock = {
  toolKey: "onepassword",
  displayName: "1Password",
  getBlocks(tool) {
    // 1Password always requires manual acceptance — show special instructions
    return [{
      id: "onepassword_setup",
      label: "1Password — Action Required",
      condition: { toolKey: "onepassword" },
      template: `<div style="margin-bottom:20px;padding:16px;background:#fef3c7;border-left:4px solid #f59e0b;border-radius:8px;">
  <h2 style="color:#92400e;font-size:16px;margin:0 0 8px;">⚠️ 1Password — Action Required</h2>
  <p style="color:#78350f;margin:0 0 8px;"><strong>Important:</strong> You'll receive a 1Password invite email. Follow these steps:</p>
  <ol style="color:#78350f;margin:0;padding-left:20px;">
    <li>Accept the 1Password invite within 24 hours</li>
    <li>Set up your Master Password (save it somewhere safe — it cannot be recovered)</li>
    <li>Install the 1Password browser extension and desktop app</li>
    <li>Once accepted, shared vaults will become available automatically</li>
  </ol>
  <p style="color:#78350f;margin:8px 0 0;"><em>Shared vaults cannot be provisioned until you accept the invite.</em></p>
</div>`,
    }];
  },
};

const fathomInstructions: ToolInstructionBlock = {
  toolKey: "fathom",
  displayName: "Fathom",
  getBlocks() {
    return [{
      id: "fathom_access",
      label: "Fathom Access Instructions",
      condition: {
        custom: (ctx: EmailContext) =>
          ctx.provisionedTools.some(
            (t) =>
              t.toolKey === "onepassword" &&
              (t.status === "success" || t.status === "manual_required")
          ) || ctx.provisionedTools.some((t) => t.toolKey === "fathom"),
      },
      template: `<div style="margin-bottom:20px;padding:16px;background:#ede9fe;border-left:4px solid #8b5cf6;border-radius:8px;">
  <h2 style="color:#18181b;font-size:16px;margin:0 0 8px;">📝 Fathom (AI Meeting Notes)</h2>
  <p style="color:#52525b;margin:0 0 8px;">Fathom is a shared team tool accessed via Google sign-in:</p>
  <ol style="color:#52525b;margin:0;padding-left:20px;">
    <li>Go to <strong>fathom.video</strong> and click "Sign in with Google"</li>
    <li>Sign in as <strong>teams@chiefaiofficer.com</strong></li>
    <li>The password is stored in the <strong>Moderators vault</strong> in 1Password</li>
    <li>You must accept your 1Password invite first to access the vault</li>
  </ol>
  <p style="color:#52525b;margin:8px 0 0;"><em>This is a shared account — do not change the password.</em></p>
</div>`,
    }];
  },
};

const zoomInstructions: ToolInstructionBlock = {
  toolKey: "zoom",
  displayName: "Zoom",
  getBlocks(tool) {
    if (tool.status === "success") {
      const licenseType = (tool.resultData?.licenseType as string) || "Licensed";
      return [{
        id: "zoom_success",
        label: "Zoom — Active",
        condition: { toolKey: "zoom", toolStatus: "success" },
        template: `<div style="margin-bottom:20px;padding:16px;background:#f0fdf4;border-left:4px solid #22c55e;border-radius:8px;">
  <h2 style="color:#18181b;font-size:16px;margin:0 0 8px;">✅ Zoom (${licenseType})</h2>
  <p style="color:#52525b;margin:0 0 8px;">Your Zoom account has been provisioned with a <strong>${licenseType}</strong> license.</p>
  <ul style="color:#52525b;margin:0;padding-left:20px;">
    <li>Sign in at <strong>zoom.us</strong> with your work email (Google SSO)</li>
    <li>Download the Zoom desktop app for the best experience</li>
    <li>Your calendar events with Zoom links will appear automatically</li>
  </ul>
</div>`,
      }];
    }

    if (tool.status === "manual_required") {
      return [{
        id: "zoom_manual",
        label: "Zoom — Pending",
        condition: { toolKey: "zoom" },
        template: `<div style="margin-bottom:20px;padding:16px;background:#fef9c3;border-left:4px solid #eab308;border-radius:8px;">
  <h2 style="color:#92400e;font-size:16px;margin:0 0 8px;">⏳ Zoom — Manual Setup Required</h2>
  <p style="color:#78350f;margin:0;">Your Zoom account requires manual provisioning by our IT team. You'll receive an invitation within 1 business day.</p>
</div>`,
      }];
    }

    return [];
  },
};

// ---- Registry ----

const TOOL_INSTRUCTION_REGISTRY: Map<string, ToolInstructionBlock> = new Map([
  ["google_workspace", googleWorkspaceInstructions],
  ["slack", slackInstructions],
  ["clickup", clickupInstructions],
  ["gohighlevel", ghlInstructions],
  ["circle", circleInstructions],
  ["onepassword", onePasswordInstructions],
  ["fathom", fathomInstructions],
  ["zoom", zoomInstructions],
]);

/**
 * Get all email blocks for provisioned tools.
 * Each tool injects its own instruction block based on status.
 */
export function getToolInstructionBlocks(
  provisionedTools: EmailContext["provisionedTools"]
): EmailBlock[] {
  const blocks: EmailBlock[] = [];

  for (const tool of provisionedTools) {
    const instructionProvider = TOOL_INSTRUCTION_REGISTRY.get(tool.toolKey);
    if (instructionProvider) {
      blocks.push(...instructionProvider.getBlocks(tool));
    }
  }

  return blocks;
}

/**
 * Register a custom tool instruction block.
 */
export function registerToolInstructions(
  block: ToolInstructionBlock
): void {
  TOOL_INSTRUCTION_REGISTRY.set(block.toolKey, block);
}

/**
 * Get all registered tool instruction providers.
 */
export function getAllToolInstructions(): ToolInstructionBlock[] {
  return Array.from(TOOL_INSTRUCTION_REGISTRY.values());
}
