// =============================================================
// Slack Notification Channel
// =============================================================
// Sends notifications to Slack channels or DMs via webhook or
// Bot Token API. Used for provisioning alerts, manual task
// assignments, and admin notifications alongside in-app notifs.
// =============================================================

import { audit } from "@/lib/audit/logger";

// ---- Types ----

export interface SlackMessage {
  channel?: string; // Channel ID or name (used with Bot Token)
  text: string; // Fallback plain text
  blocks?: SlackBlock[]; // Rich Block Kit message
  threadTs?: string; // Reply to a thread
}

export interface SlackBlock {
  type: string;
  text?: { type: string; text: string; emoji?: boolean };
  elements?: Array<{ type: string; text?: { type: string; text: string }; url?: string }>;
  fields?: Array<{ type: string; text: string }>;
  accessory?: Record<string, unknown>;
  [key: string]: unknown;
}

export type SlackNotifyEvent =
  | "onboarding_submitted"
  | "provisioning_complete"
  | "provisioning_failed"
  | "step_requires_manual"
  | "manual_task_assigned"
  | "approval_needed";

// ---- Configuration ----

function getWebhookUrl(): string | undefined {
  return process.env.SLACK_WEBHOOK_URL;
}

function getBotToken(): string | undefined {
  return process.env.SLACK_BOT_TOKEN;
}

function getDefaultChannel(): string {
  return process.env.SLACK_NOTIFICATIONS_CHANNEL || "#ops-onboarding";
}

// ---- Webhook Sender ----

async function sendViaWebhook(message: SlackMessage): Promise<boolean> {
  const webhookUrl = getWebhookUrl();
  if (!webhookUrl) {
    console.warn("[SLACK] No SLACK_WEBHOOK_URL configured — skipping notification");
    return false;
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: message.text,
        blocks: message.blocks,
        thread_ts: message.threadTs,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      console.error(`[SLACK] Webhook failed (${response.status}): ${body}`);
      return false;
    }

    return true;
  } catch (error) {
    console.error("[SLACK] Webhook request error:", error);
    return false;
  }
}

// ---- Bot Token Sender (for channel-specific messages) ----

async function sendViaBotToken(message: SlackMessage): Promise<boolean> {
  const token = getBotToken();
  if (!token) {
    console.warn("[SLACK] No SLACK_BOT_TOKEN configured — falling back to webhook");
    return sendViaWebhook(message);
  }

  const channel = message.channel || getDefaultChannel();

  try {
    const response = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        channel,
        text: message.text,
        blocks: message.blocks,
        thread_ts: message.threadTs,
      }),
    });

    const result = await response.json() as { ok: boolean; error?: string };

    if (!result.ok) {
      console.error(`[SLACK] Bot API error: ${result.error}`);
      // Fall back to webhook if bot fails
      return sendViaWebhook(message);
    }

    return true;
  } catch (error) {
    console.error("[SLACK] Bot API request error:", error);
    return sendViaWebhook(message);
  }
}

// ---- Public API ----

/**
 * Send a Slack notification. Prefers Bot Token API if available,
 * falls back to incoming webhook.
 */
export async function sendSlackNotification(message: SlackMessage): Promise<boolean> {
  const success = getBotToken()
    ? await sendViaBotToken(message)
    : await sendViaWebhook(message);

  if (success) {
    await audit({
      action: "notification_sent",
      details: { channel: "slack", text: message.text.slice(0, 100) },
    }).catch(() => {}); // Don't fail on audit errors
  }

  return success;
}

/**
 * Send a structured onboarding event notification to Slack.
 */
export async function notifySlack(
  event: SlackNotifyEvent,
  data: {
    employeeName: string;
    requestId: string;
    department?: string;
    tool?: string;
    error?: string;
    assignee?: string;
    dashboardUrl?: string;
  }
): Promise<boolean> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const requestUrl = `${appUrl}/onboarding/${data.requestId}`;

  const messages: Record<SlackNotifyEvent, SlackMessage> = {
    onboarding_submitted: {
      text: `New onboarding request submitted for ${data.employeeName}`,
      blocks: [
        {
          type: "header",
          text: { type: "plain_text", text: "New Onboarding Request", emoji: true },
        },
        {
          type: "section",
          fields: [
            { type: "mrkdwn", text: `*Employee:*\n${data.employeeName}` },
            { type: "mrkdwn", text: `*Department:*\n${data.department || "—"}` },
          ],
        },
        {
          type: "actions",
          elements: [
            {
              type: "button",
              text: { type: "plain_text", text: "View Request" },
              url: requestUrl,
            },
          ],
        },
      ],
    },

    provisioning_complete: {
      text: `Provisioning complete for ${data.employeeName}`,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `:white_check_mark: *Provisioning complete* for *${data.employeeName}*`,
          },
        },
        {
          type: "actions",
          elements: [
            { type: "button", text: { type: "plain_text", text: "View Details" }, url: requestUrl },
          ],
        },
      ],
    },

    provisioning_failed: {
      text: `Provisioning failed for ${data.employeeName}: ${data.tool || "unknown tool"}`,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `:x: *Provisioning failed* for *${data.employeeName}*\n*Tool:* ${data.tool || "—"}\n*Error:* ${data.error || "Unknown error"}`,
          },
        },
        {
          type: "actions",
          elements: [
            { type: "button", text: { type: "plain_text", text: "Retry / View" }, url: requestUrl },
          ],
        },
      ],
    },

    step_requires_manual: {
      text: `Manual action required for ${data.employeeName} (${data.tool})`,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `:warning: *Manual action required* for *${data.employeeName}*\n*Tool:* ${data.tool || "—"}`,
          },
        },
        {
          type: "actions",
          elements: [
            { type: "button", text: { type: "plain_text", text: "View Task" }, url: requestUrl },
          ],
        },
      ],
    },

    manual_task_assigned: {
      text: `Manual task assigned to ${data.assignee} for ${data.employeeName}`,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `:clipboard: *Manual task assigned* to *${data.assignee || "unassigned"}*\nFor: *${data.employeeName}* — ${data.tool || "General"}`,
          },
        },
        {
          type: "actions",
          elements: [
            { type: "button", text: { type: "plain_text", text: "View Task" }, url: requestUrl },
          ],
        },
      ],
    },

    approval_needed: {
      text: `Onboarding request for ${data.employeeName} needs approval`,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `:eyes: *Approval needed* for onboarding request\n*Employee:* ${data.employeeName}\n*Department:* ${data.department || "—"}`,
          },
        },
        {
          type: "actions",
          elements: [
            { type: "button", text: { type: "plain_text", text: "Review & Approve" }, url: requestUrl },
          ],
        },
      ],
    },
  };

  const message = messages[event];
  if (!message) {
    console.warn(`[SLACK] Unknown event type: ${event}`);
    return false;
  }

  return sendSlackNotification(message);
}
