import type {
  ProvisioningProvider,
  ProvisioningContext,
  ProvisioningConfig,
  ProvisioningResult,
  N8nWebhookPayload,
} from "./types";

const WEBHOOK_PATH = "/webhook/provision-onepassword";

export const onepasswordProvider: ProvisioningProvider = {
  toolKey: "onepassword",
  displayName: "1Password",
  icon: "KeyRound",
  supportsRetry: false,
  defaultExecutionOrder: 40,

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
      inviteSent?: boolean;
      vaults?: string[];
      error?: string;
      executionId?: string;
    };

    if (data.status === "success") {
      return {
        success: true,
        data: {
          inviteSent: data.inviteSent,
          vaults: data.vaults,
        },
        n8nExecutionId: data.executionId,
      };
    }

    // Invite was sent but overall status is not success — user must accept
    // the invite before vaults can be shared.
    if (data.inviteSent) {
      return {
        success: false,
        errorMessage: data.error ?? "1Password provisioning incomplete",
        retryable: false,
        requiresManualAction: true,
        manualActionDescription:
          "Accept the 1Password invite before vaults can be shared",
        n8nExecutionId: data.executionId,
      };
    }

    return {
      success: false,
      errorMessage: data.error ?? "1Password provisioning failed",
      retryable: false,
      n8nExecutionId: data.executionId,
    };
  },

  validateConfig(config: ProvisioningConfig): string[] {
    const errors: string[] = [];

    if (!config.vault_names || config.vault_names.length === 0) {
      errors.push("vault_names is required for 1Password provisioning");
    }

    return errors;
  },
};
