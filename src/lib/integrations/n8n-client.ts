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
