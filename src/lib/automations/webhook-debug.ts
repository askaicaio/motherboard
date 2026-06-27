// =============================================================
// TEMPORARY: Zapier webhook inspector storage
// =============================================================
// A throwaway debug helper for ONE investigation: confirm what Zapier's
// "New Zap Error" trigger actually sends us (specifically whether the payload
// carries the erroring Zap's ID / link, or only its title).
//
// Captured payloads are stored in the existing `app_settings` key/value table
// under a single key (a JSON array, newest first, capped) so there is NO
// migration and nothing to clean up in the schema. Delete this file, its two
// API routes, the viewer page/component, and the proxy exemption once the
// question is answered.
// =============================================================

import { db } from "@/lib/db";
import { appSettings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const KEY = "zapier_webhook_debug";

/** Keep only the most recent N captures so app_settings doesn't bloat. */
const MAX_CAPTURES = 25;
/** Cap a single raw body so one huge payload can't blow up the row. */
const MAX_BODY_CHARS = 20_000;

/**
 * The unguessable path secret for the PUBLIC ingest endpoint. Zapier has no
 * login, so the endpoint is public; this secret segment keeps it from being
 * trivially discoverable/spammed. Temporary tool in a private repo, so a baked
 * constant is acceptable (no Vercel env var needed to use it).
 */
export const WEBHOOK_DEBUG_SECRET = "zap-err-probe-7f3a9c2e1b";

/** Path Zapier should POST to (prefix with the deployment origin). */
export const WEBHOOK_DEBUG_INGEST_PATH = `/api/zapier-webhook-debug/${WEBHOOK_DEBUG_SECRET}`;

export interface WebhookCapture {
  id: string;
  /** ISO timestamp of when we received it. */
  receivedAt: string;
  method: string;
  /** Query-string params, if any. */
  query: Record<string, string>;
  contentType: string | null;
  /** Request headers (cookie / authorization redacted). */
  headers: Record<string, string>;
  /** Raw request body, truncated to MAX_BODY_CHARS. */
  rawBody: string;
  /** JSON.parse(rawBody) when it parsed as JSON, else null. */
  parsed: unknown | null;
  /** Form-encoded body parsed to an object, when applicable. */
  form: Record<string, string> | null;
}

export async function getCaptures(): Promise<WebhookCapture[]> {
  const [row] = await db
    .select({ value: appSettings.value })
    .from(appSettings)
    .where(eq(appSettings.key, KEY))
    .limit(1);
  if (!row || !Array.isArray(row.value)) return [];
  return row.value as WebhookCapture[];
}

async function writeCaptures(captures: WebhookCapture[]): Promise<void> {
  await db
    .insert(appSettings)
    .values({
      key: KEY,
      value: captures as never,
      updatedBy: null,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { value: captures as never, updatedAt: new Date() },
    });
}

/** Prepend a new capture (newest first) and trim to MAX_CAPTURES. */
export async function appendCapture(
  capture: Omit<WebhookCapture, "rawBody"> & { rawBody: string },
): Promise<void> {
  const trimmed: WebhookCapture = {
    ...capture,
    rawBody: capture.rawBody.slice(0, MAX_BODY_CHARS),
  };
  const existing = await getCaptures();
  const next = [trimmed, ...existing].slice(0, MAX_CAPTURES);
  await writeCaptures(next);
}

export async function clearCaptures(): Promise<void> {
  await writeCaptures([]);
}
