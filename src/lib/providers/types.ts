// =============================================================
// Provisioning Provider Interface
// =============================================================

export interface ProvisioningConfig {
  groups?: string[];
  channels?: string[];
  permissions?: string[];
  role?: string;
  license_type?: string;
  vault_names?: string[];
  org_unit?: string;
  spaces?: string[];
  ghl_role?: string;
  ghl_location_ids?: string[];
  circle_space_groups?: string[];
  user_groups?: string[];
  [key: string]: unknown;
}

export interface ProvisioningContext {
  requestId: string;
  stepId: string;
  idempotencyKey: string;
  employee: {
    name: string;
    email: string;
    personalEmail?: string;
    jobTitle: string;
    department: string;
    division: string;
    managerEmail?: string;
    startDate: string;
  };
  config: ProvisioningConfig;
  attemptNumber: number;
}

export interface ProvisioningResult {
  success: boolean;
  data?: Record<string, unknown>;
  errorMessage?: string;
  retryable?: boolean;
  requiresManualAction?: boolean;
  manualActionDescription?: string;
  n8nExecutionId?: string;
}

export interface N8nWebhookPayload {
  webhookPath: string;
  body: {
    callbackUrl: string;
    idempotencyKey: string;
    requestId: string;
    stepId: string;
    toolKey: string;
    employee: ProvisioningContext["employee"];
    config: ProvisioningConfig;
    attemptNumber: number;
  };
}

/**
 * Every provisioning provider implements this interface.
 * Providers don't call external APIs directly — they build
 * n8n webhook payloads and interpret callback results.
 */
export interface ProvisioningProvider {
  readonly toolKey: string;
  readonly displayName: string;
  readonly icon: string;
  readonly supportsRetry: boolean;
  readonly defaultExecutionOrder: number;

  buildN8nPayload(context: ProvisioningContext): N8nWebhookPayload;
  parseN8nCallback(callbackData: unknown): ProvisioningResult;
  validateConfig(config: ProvisioningConfig): string[];
}
