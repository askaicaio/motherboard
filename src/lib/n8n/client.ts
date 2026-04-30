import crypto from "crypto";
import type { N8nWebhookPayload } from "@/lib/providers/types";

const MOCK_DELAY_MS = 2000;

/**
 * Send a provisioning request to n8n or simulate it in mock mode.
 */
export async function triggerN8nWebhook(
  payload: N8nWebhookPayload
): Promise<{ triggered: boolean; executionId?: string; error?: string }> {
  const mode = process.env.PROVISIONING_MODE || "mock";

  if (mode === "mock") {
    return triggerMock(payload);
  }

  return triggerLive(payload);
}

async function triggerLive(
  payload: N8nWebhookPayload
): Promise<{ triggered: boolean; executionId?: string; error?: string }> {
  const baseUrl = process.env.N8N_BASE_URL;
  if (!baseUrl) {
    return { triggered: false, error: "N8N_BASE_URL is not configured" };
  }

  const url = `${baseUrl}${payload.webhookPath}`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload.body),
    });

    if (!response.ok) {
      const text = await response.text();
      return { triggered: false, error: `n8n responded ${response.status}: ${text}` };
    }

    const data = await response.json();
    return { triggered: true, executionId: data.executionId };
  } catch (error) {
    return {
      triggered: false,
      error: `Failed to reach n8n: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

/**
 * Mock mode: simulate n8n by posting back to the callback URL
 * after a short delay. 80% chance of success, 20% chance of failure.
 */
async function triggerMock(
  payload: N8nWebhookPayload
): Promise<{ triggered: boolean; executionId?: string }> {
  const mockExecutionId = `mock_${crypto.randomUUID().slice(0, 8)}`;

  // Fire-and-forget: simulate async callback after delay
  setTimeout(async () => {
    const success = Math.random() > 0.2;
    const callbackBody = {
      stepId: payload.body.stepId,
      toolKey: payload.body.toolKey,
      status: success ? "success" : "failed",
      executionId: mockExecutionId,
      ...(success
        ? { data: generateMockSuccessData(payload.body.toolKey, payload.body.employee.email) }
        : { error: "Mock provisioning failure for testing", retryable: true }),
    };

    try {
      const secret = process.env.N8N_WEBHOOK_SECRET || "mock-secret";
      const bodyStr = JSON.stringify(callbackBody);
      const signature = crypto
        .createHmac("sha256", secret)
        .update(bodyStr)
        .digest("hex");

      await fetch(payload.body.callbackUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-N8N-Signature": signature,
        },
        body: bodyStr,
      });
    } catch {
      console.error(`[MOCK] Failed to post callback for step ${payload.body.stepId}`);
    }
  }, MOCK_DELAY_MS);

  return { triggered: true, executionId: mockExecutionId };
}

function generateMockSuccessData(
  toolKey: string,
  email: string
): Record<string, unknown> {
  const mockData: Record<string, Record<string, unknown>> = {
    google_workspace: { email, userId: `goog_${crypto.randomUUID().slice(0, 6)}`, orgUnit: "/Employees", groups: ["all-company"] },
    slack: { slackUserId: `U${crypto.randomUUID().slice(0, 8).toUpperCase()}`, channels: ["general", "announcements"] },
    clickup: { clickupUserId: `ck_${crypto.randomUUID().slice(0, 6)}`, teams: ["Engineering"] },
    gohighlevel: { ghlUserId: `ghl_${crypto.randomUUID().slice(0, 6)}`, locationIds: ["loc_1"] },
    circle: { circleMemberId: `cir_${crypto.randomUUID().slice(0, 6)}`, spaceGroups: ["Team Members"] },
    onepassword: { inviteSent: true, vaults: ["Shared"] },
  };
  return mockData[toolKey] || {};
}

/**
 * Verify HMAC-SHA256 signature from n8n callback.
 */
export function verifyN8nSignature(body: string, signature: string): boolean {
  const secret = process.env.N8N_WEBHOOK_SECRET;
  if (!secret) {
    console.warn("[N8N] No webhook secret configured — skipping signature verification");
    return true; // In development, allow unsigned callbacks
  }
  const expected = crypto.createHmac("sha256", secret).update(body).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}
