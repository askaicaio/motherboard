import type {
  ProvisioningProvider,
  ProvisioningContext,
  ProvisioningConfig,
  ProvisioningResult,
  N8nWebhookPayload,
} from "./types";

const WEBHOOK_PATH = "/webhook/provision-google-workspace";

export const googleWorkspaceProvider: ProvisioningProvider = {
  toolKey: "google_workspace",
  displayName: "Google Workspace",
  icon: "Mail",
  supportsRetry: true,
  defaultExecutionOrder: 10,

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
      email?: string;
      userId?: string;
      orgUnit?: string;
      groups?: string[];
      error?: string;
      retryable?: boolean;
      executionId?: string;
    };

    if (data.status === "success") {
      return {
        success: true,
        data: {
          email: data.email,
          userId: data.userId,
          orgUnit: data.orgUnit,
          groups: data.groups,
        },
        n8nExecutionId: data.executionId,
      };
    }

    return {
      success: false,
      errorMessage: data.error ?? "Google Workspace provisioning failed",
      retryable: data.retryable ?? false,
      n8nExecutionId: data.executionId,
    };
  },

  validateConfig(config: ProvisioningConfig): string[] {
    const errors: string[] = [];

    if (!config.license_type) {
      errors.push("license_type is required for Google Workspace provisioning");
    }

    return errors;
  },
};
