import type {
  ProvisioningProvider,
  ProvisioningContext,
  ProvisioningConfig,
  ProvisioningResult,
  N8nWebhookPayload,
} from "./types";

const WEBHOOK_PATH = "/webhook/provision-zoom";

export const zoomProvider: ProvisioningProvider = {
  toolKey: "zoom",
  displayName: "Zoom",
  icon: "Video",
  supportsRetry: true,
  defaultExecutionOrder: 25,

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
      zoomUserId?: string;
      zoomEmail?: string;
      licenseType?: string;
      error?: string;
      retryable?: boolean;
      executionId?: string;
    };

    if (data.status === "success") {
      return {
        success: true,
        data: {
          zoomUserId: data.zoomUserId,
          zoomEmail: data.zoomEmail,
          licenseType: data.licenseType,
        },
        n8nExecutionId: data.executionId,
      };
    }

    // Zoom may require admin plan for user provisioning
    if (data.error?.includes("plan") || data.error?.includes("license")) {
      return {
        success: false,
        errorMessage: data.error,
        retryable: false,
        requiresManualAction: true,
        manualActionDescription:
          "Zoom license/plan constraint. Manually add user via admin.zoom.us.",
        n8nExecutionId: data.executionId,
      };
    }

    return {
      success: false,
      errorMessage: data.error ?? "Zoom provisioning failed",
      retryable: data.retryable ?? true,
      n8nExecutionId: data.executionId,
    };
  },

  validateConfig(config: ProvisioningConfig): string[] {
    const errors: string[] = [];
    if (config.license_type && !["basic", "licensed", "on-prem"].includes(config.license_type)) {
      errors.push("Zoom license_type must be basic, licensed, or on-prem");
    }
    return errors;
  },
};
