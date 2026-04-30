export interface N8nCallbackPayload {
  stepId: string;
  toolKey: string;
  status: "success" | "failed";
  data?: Record<string, unknown>;
  error?: string;
  retryable?: boolean;
  executionId?: string;
}
