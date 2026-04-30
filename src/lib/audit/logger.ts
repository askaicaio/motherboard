import { db } from "@/lib/db";
import { auditLogs } from "@/lib/db/schema";
import type { AuditAction } from "@/types";

interface AuditEntry {
  action: AuditAction;
  requestId?: string | null;
  actorId?: string | null;
  actorEmail?: string | null;
  details: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
}

const REDACT_PATTERNS = /password|secret|token|api_key|credential|private_key/i;

function redactDetails(obj: Record<string, unknown>): Record<string, unknown> {
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (REDACT_PATTERNS.test(key)) {
      cleaned[key] = "[REDACTED]";
    } else if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      cleaned[key] = redactDetails(value as Record<string, unknown>);
    } else {
      cleaned[key] = value;
    }
  }
  return cleaned;
}

export async function audit(entry: AuditEntry): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      action: entry.action,
      requestId: entry.requestId ?? null,
      actorId: entry.actorId ?? null,
      actorEmail: entry.actorEmail ?? null,
      details: redactDetails(entry.details),
      ipAddress: entry.ipAddress ?? null,
      userAgent: entry.userAgent ?? null,
    });
  } catch (error) {
    // Audit logging should never break the main flow
    console.error("[AUDIT] Failed to write audit log:", error);
  }
}
