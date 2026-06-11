// =============================================================
// Make (make.com) API client — read-only scenario listing
// =============================================================
// Used by the Make automations sync to pull every scenario in the org,
// with its name, active/paused status, and a link back to the Make editor.
//
// Creds come from env:
//   - MAKE_API_TOKEN  (required, secret) — Make API token (scenarios:read)
//   - MAKE_ZONE       (optional)         — region host, defaults to "us1"
//   - MAKE_ORG_ID     (optional)         — organization ID, defaults to "1193307"
// Only MAKE_API_TOKEN must be set in Vercel; the zone + org have sensible
// defaults for our single Make account and rarely change.
//
// Make API quirks:
//   - Authorization: Token <api-token>   (the word "Token", not "Bearer")
//   - List scenarios: GET /api/v2/scenarios?organizationId=<id>
//   - Pagination via pg[limit] / pg[offset]
//   - Each scenario carries isActive / isPaused and a teamId (used to build
//     the editor URL: https://<zone>.make.com/<teamId>/scenarios/<id>/edit)
// =============================================================

const DEFAULT_ZONE = "us1";
const DEFAULT_ORG_ID = "1193307";

/** A scenario as returned by GET /api/v2/scenarios (only the fields we use). */
export interface MakeScenario {
  id: number | string;
  name: string;
  teamId: number | string;
  isActive?: boolean;
  isPaused?: boolean;
}

/** A scenario normalized into the shape our sync wants. */
export interface MakeAutomation {
  /** Scenario name (Column 1 in the table). */
  name: string;
  /** Editor URL — the automation's identity (unique). */
  url: string;
  /** "active" | "paused" derived from isActive. */
  status: "active" | "paused";
}

function getCreds() {
  const token = process.env.MAKE_API_TOKEN;
  if (!token) {
    throw new Error(
      "MAKE_API_TOKEN is not set. Add it to Vercel env vars (Production).",
    );
  }
  const zone = process.env.MAKE_ZONE || DEFAULT_ZONE;
  const orgId = process.env.MAKE_ORG_ID || DEFAULT_ORG_ID;
  return { token, zone, orgId };
}

function buildHeaders(token: string): HeadersInit {
  return {
    Authorization: `Token ${token}`,
    Accept: "application/json",
  };
}

/** Build the Make editor URL for a scenario — this is the row's identity. */
export function scenarioUrl(
  zone: string,
  teamId: number | string,
  scenarioId: number | string,
): string {
  return `https://${zone}.make.com/${teamId}/scenarios/${scenarioId}/edit`;
}

// Page size + a hard cap so a misconfiguration can't loop forever.
const PAGE_SIZE = 100;
const MAX_SCENARIOS = 5000;

/**
 * List every scenario in the organization, normalized for the sync.
 * Walks all pages (pg[offset] / pg[limit]) until a short page is returned
 * or the safety cap is hit.
 */
export async function listMakeAutomations(): Promise<MakeAutomation[]> {
  const { token, zone, orgId } = getCreds();
  const headers = buildHeaders(token);

  const out: MakeAutomation[] = [];
  let offset = 0;

  while (true) {
    const url =
      `https://${zone}.make.com/api/v2/scenarios` +
      `?organizationId=${encodeURIComponent(orgId)}` +
      `&pg[limit]=${PAGE_SIZE}&pg[offset]=${offset}`;

    const res = await fetch(url, { headers });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(
        `Make scenarios request failed (${res.status}): ${text.slice(0, 500)}`,
      );
    }

    const json = (await res.json()) as { scenarios?: MakeScenario[] };
    const batch = json.scenarios ?? [];

    for (const s of batch) {
      // Without a team + id we can't build the identity URL — skip it.
      if (s.id == null || s.teamId == null) continue;
      out.push({
        name: (s.name ?? "").trim(),
        url: scenarioUrl(zone, s.teamId, s.id),
        status: s.isActive ? "active" : "paused",
      });
    }

    if (batch.length < PAGE_SIZE) break; // last page
    if (out.length >= MAX_SCENARIOS) {
      console.warn(
        `[Make] Hit MAX_SCENARIOS (${MAX_SCENARIOS}) — truncating sync.`,
      );
      break;
    }
    offset += PAGE_SIZE;
    // Mild throttle to stay well under rate limits.
    await new Promise((r) => setTimeout(r, 100));
  }

  return out;
}
