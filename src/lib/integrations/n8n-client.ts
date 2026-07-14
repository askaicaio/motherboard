// =============================================================
// n8n API client — read-only workflow listing
// =============================================================
// Mirrors make-client.ts (see there for the overall shape). Used by the n8n
// automations sync to pull every workflow in the instance, with its name,
// active/inactive status, and a link back to the n8n editor.
//
// Creds come from env:
//   - N8N_API_KEY   (required, secret)  — an n8n API key (Settings -> n8n API)
//   - N8N_BASE_URL  (required)          — the instance root, e.g.
//                                         https://acme.app.n8n.cloud  (Cloud)
//                                         https://n8n.yourco.com      (self-host)
//                                         NO trailing slash, NO /api/v1 suffix.
// Both must be set in Vercel (Production). Unlike Make there is no sensible
// default for the base URL — every n8n instance lives at its own address — so
// it is required, not defaulted.
//
// n8n API quirks (public REST API v1):
//   - Auth header: X-N8N-API-KEY: <key>   (NOT "Authorization")
//   - List workflows: GET /api/v1/workflows
//   - Pagination via ?limit= and an opaque ?cursor= (nextCursor in the body),
//     NOT numeric offsets like Make.
//   - A workflow carries `active` (boolean); we map it to our "active" /
//     "paused" two-state status (n8n "inactive" -> "paused").
//   - Editor URL (the row's identity): <base>/workflow/<id>
// =============================================================

function getCreds() {
  const apiKey = process.env.N8N_API_KEY;
  if (!apiKey) {
    throw new Error(
      "N8N_API_KEY is not set. Add it to Vercel env vars (Production).",
    );
  }
  const rawBase = process.env.N8N_BASE_URL;
  if (!rawBase) {
    throw new Error(
      "N8N_BASE_URL is not set. Add your n8n instance URL to Vercel env vars " +
        "(Production), e.g. https://acme.app.n8n.cloud (no trailing slash).",
    );
  }
  // Tolerate a trailing slash or an accidental /api/v1 suffix in the env value.
  const base = rawBase.replace(/\/+$/, "").replace(/\/api\/v1$/, "");
  return { apiKey, base };
}

function buildHeaders(apiKey: string): HeadersInit {
  return {
    "X-N8N-API-KEY": apiKey,
    Accept: "application/json",
  };
}

/** Build the n8n editor URL for a workflow — this is the row's identity. */
export function workflowUrl(base: string, workflowId: number | string): string {
  return `${base}/workflow/${workflowId}`;
}

/** A workflow as returned by GET /api/v1/workflows (only the fields we use). */
interface N8nWorkflow {
  id: number | string;
  name?: string;
  active?: boolean;
  /** ISO 8601 timestamp of the last edit — n8n returns this on the workflow
   *  object itself, in the same list response (no extra request needed). */
  updatedAt?: string;
}

/** A workflow normalized into the shape our sync wants (mirrors MakeAutomation). */
export interface N8nAutomation {
  /** Workflow id — needed to fetch its executions (last run). */
  id: number | string;
  /** Workflow name (Column 1 in the table). */
  name: string;
  /** Editor URL — the automation's identity (unique). */
  url: string;
  /** "active" | "paused" derived from the workflow's `active` flag. */
  status: "active" | "paused";
  /** ISO 8601 last-edited timestamp (workflow `updatedAt`), or null when n8n
   *  didn't return one. Feeds the "Last Edited" column. */
  lastEditedAt: string | null;
}

// Page size (n8n caps `limit` at 250) + a hard cap so a misconfiguration
// can't loop forever.
const PAGE_SIZE = 100;
const MAX_WORKFLOWS = 5000;

/**
 * List every workflow in the n8n instance, normalized for the sync.
 * Walks all pages via the opaque cursor (n8n returns `nextCursor`; a null/absent
 * cursor means the last page) until exhausted or the safety cap is hit.
 */
export async function listN8nAutomations(): Promise<N8nAutomation[]> {
  const { apiKey, base } = getCreds();
  const headers = buildHeaders(apiKey);

  const out: N8nAutomation[] = [];
  let cursor: string | null = null;

  while (true) {
    let url = `${base}/api/v1/workflows?limit=${PAGE_SIZE}`;
    if (cursor) url += `&cursor=${encodeURIComponent(cursor)}`;

    const res = await fetch(url, { headers });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(
        `n8n workflows request failed (${res.status}): ${text.slice(0, 500)}`,
      );
    }

    const json = (await res.json()) as {
      data?: N8nWorkflow[];
      nextCursor?: string | null;
    };
    const batch = json.data ?? [];

    for (const w of batch) {
      // Without an id we can't build the identity URL — skip it.
      if (w.id == null) continue;
      out.push({
        id: w.id,
        name: (w.name ?? "").trim(),
        url: workflowUrl(base, w.id),
        status: w.active ? "active" : "paused",
        lastEditedAt: w.updatedAt ?? null,
      });
    }

    cursor = json.nextCursor ?? null;
    if (!cursor) break; // last page
    if (out.length >= MAX_WORKFLOWS) {
      console.warn(
        `[n8n] Hit MAX_WORKFLOWS (${MAX_WORKFLOWS}) — truncating sync.`,
      );
      break;
    }
    // Mild throttle to stay well under rate limits.
    await new Promise((r) => setTimeout(r, 100));
  }

  return out;
}

/**
 * Fetch a workflow's last-run timestamp from its executions.
 *
 * Unlike Make, n8n exposes execution history reliably: the most recent
 * execution (the API returns them newest-first) carries `stoppedAt`/`startedAt`
 * (ISO 8601). Returns that string, or null when the workflow has never run or
 * the request fails. Callers must treat null as "unknown, leave unchanged",
 * never as "wipe it".
 */
export async function getN8nLastRunAt(
  workflowId: number | string,
): Promise<string | null> {
  const { apiKey, base } = getCreds();
  const headers = buildHeaders(apiKey);
  const url =
    `${base}/api/v1/executions` +
    `?workflowId=${encodeURIComponent(String(workflowId))}&limit=1`;

  const res = await fetch(url, { headers });
  if (!res.ok) return null;

  const json = (await res.json().catch(() => ({}))) as {
    data?: { startedAt?: string; stoppedAt?: string }[];
  };
  const last = json.data?.[0];
  return last?.stoppedAt ?? last?.startedAt ?? null;
}

/** An errored execution, normalized for error-tracking capture (mirrors
 *  MakeScenarioError). */
export interface N8nWorkflowError {
  /** n8n's execution id — unique per instance, used as the idempotency key so
   *  re-polling the same error never duplicates. */
  externalErrorId: string;
  /** ISO 8601 timestamp of the errored execution (the "Error Date"). n8n's
   *  `stoppedAt`, falling back to `startedAt` for a run that never stopped. */
  occurredAt: string;
  /** The workflow-level error description, or null when unavailable (we only
   *  get it when the rich `includeData` pull succeeds — see below). */
  message: string | null;
}

/** One execution as returned by GET /api/v1/executions (only the fields we use).
 *  `data` is present only when the request asked for `includeData=true`. */
interface N8nExecution {
  id?: number | string;
  startedAt?: string;
  stoppedAt?: string;
  data?: {
    resultData?: {
      error?: { message?: string; description?: string; name?: string };
    };
  };
}

/** Pull the workflow-level error message out of an includeData execution. */
function n8nErrorMessage(e: N8nExecution): string | null {
  const err = e.data?.resultData?.error;
  return err?.message ?? err?.description ?? err?.name ?? null;
}

/** GET the executions list, returning the parsed body or null on any non-200 /
 *  parse failure (callers treat null as "try the fallback / no errors"). */
async function fetchN8nExecutions(
  url: string,
  headers: HeadersInit,
): Promise<{ data?: N8nExecution[] } | null> {
  const res = await fetch(url, { headers });
  if (!res.ok) return null;
  return (await res.json().catch(() => null)) as {
    data?: N8nExecution[];
  } | null;
}

/**
 * List a workflow's ERRORED executions (status=error) for error tracking.
 *
 * Mirrors make-client's listMakeScenarioErrors. One request per workflow: n8n
 * accepts a `status=error` filter, so we pull only failed executions. The error
 * MESSAGE lives in the execution's run data, which needs `includeData=true` —
 * but that can 400 ("Invalid string length") when a run's payload is huge
 * (n8n GitHub #20706-adjacent), so this is best-effort: try the rich pull first,
 * and on failure fall back to a dataless list so we still capture the essential
 * date + idempotency id (message = null). Returns [] on any non-200 (e.g. a
 * 429): callers treat that as "no new errors this pass" and the idempotent
 * upsert catches up next run. Never throws for a bad response (only getCreds
 * throws when creds are unset).
 */
export async function listN8nWorkflowErrors(
  workflowId: number | string,
  limit = 20,
): Promise<N8nWorkflowError[]> {
  const { apiKey, base } = getCreds();
  const headers = buildHeaders(apiKey);
  const listUrl =
    `${base}/api/v1/executions` +
    `?status=error&workflowId=${encodeURIComponent(String(workflowId))}` +
    `&limit=${limit}`;

  // Prefer the rich pull (carries the message); fall back to dataless on 400.
  let withData = true;
  let json = await fetchN8nExecutions(`${listUrl}&includeData=true`, headers);
  if (!json) {
    withData = false;
    json = await fetchN8nExecutions(listUrl, headers);
  }
  if (!json) return [];

  const out: N8nWorkflowError[] = [];
  for (const e of json.data ?? []) {
    const externalErrorId = e.id != null ? String(e.id) : null;
    const occurredAt = e.stoppedAt ?? e.startedAt ?? null;
    if (!externalErrorId || !occurredAt) continue; // need both to store + dedupe
    out.push({
      externalErrorId,
      occurredAt,
      message: withData ? n8nErrorMessage(e) : null,
    });
  }
  return out;
}

/**
 * Live-verify the n8n credentials actually work (used by the Main Page card's
 * "check status" button). Makes a tiny authenticated request; returns true only
 * on a 200. Returns false when there's no key/URL configured, the key is
 * invalid/revoked (401/403), the URL is wrong/unreachable, or the request
 * errors. Note: this is binary — a transient n8n outage also reads as false.
 */
export async function verifyN8nToken(): Promise<boolean> {
  let creds;
  try {
    creds = getCreds(); // throws when N8N_API_KEY / N8N_BASE_URL are unset
  } catch {
    return false;
  }
  const { apiKey, base } = creds;
  try {
    const res = await fetch(`${base}/api/v1/workflows?limit=1`, {
      headers: buildHeaders(apiKey),
    });
    return res.ok;
  } catch {
    return false;
  }
}
