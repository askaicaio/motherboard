import type {
  ProvisioningProvider,
  ProvisioningContext,
  ProvisioningConfig,
  ProvisioningResult,
  N8nWebhookPayload,
} from "./types";

const WEBHOOK_PATH = "/webhook/provision-gohighlevel";

export const gohighlevelProvider: ProvisioningProvider = {
  toolKey: "gohighlevel",
  displayName: "GoHighLevel",
  icon: "Megaphone",
  supportsRetry: true,
  defaultExecutionOrder: 30,

  buildN8nPayload(context: ProvisioningContext): N8nWebhookPayload {
    const callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/provisioning/callback`;

    return {
      webhookPath: WEBHOOK_PATH,
      body: {
        callbackUrl,
        idempotencyKey: context.idempotencyKey,
        requestId: context.requestId,
        stepId: context.stepId,
        toolKey: this.toolKey,
        employee: context.employee,
        config: context.config,
        attemptNumber: context.attemptNumber,
      },
    };
  },

  parseN8nCallback(callbackData: unknown): ProvisioningResult {
    const data = callbackData as {
      status?: string;
      ghlUserId?: string;
      locationIds?: string[];
      error?: string;
      retryable?: boolean;
      executionId?: string;
    };

    if (data.status === "success") {
      return {
        success: true,
        data: {
          ghlUserId: data.ghlUserId,
          locationIds: data.locationIds,
        },
        n8nExecutionId: data.executionId,
      };
    }

    return {
      success: false,
      errorMessage: data.error ?? "GoHighLevel provisioning failed",
      retryable: data.retryable ?? false,
      n8nExecutionId: data.executionId,
    };
  },

  validateConfig(_config: ProvisioningConfig): string[] {
    return [];
  },
};
