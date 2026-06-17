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
