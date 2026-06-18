// =============================================================
// GoHighLevel v2 API client — read-only contact search
// =============================================================
// Used by the campaign sync job to pull contacts that match a tag.
// Token comes from env (GHL_API_TOKEN). Location ID comes from env
// (GHL_LOCATION_ID) but can be overridden per call if we ever need
// multi-location support.
//
// Notable v2 API quirks:
//   - Authorization: Bearer pit-... (Private Integration Token)
//   - Version: 2021-07-28 header is REQUIRED — missing it returns 400
//   - Pagination: pageLimit (max 100) + startAfter / startAfterId cursor
//   - Tag filter uses operator "contains" with a single-string value
// =============================================================

const BASE = "https://services.leadconnectorhq.com";
const API_VERSION = "2021-07-28";

export interface GHLAttribution {
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmContent?: string | null;
  utmTerm?: string | null;
  referrer?: string | null;
  sessionSource?: string | null;
  url?: string | null;
}

export interface GHLContact {
  id: string;
  locationId: string;
  email?: string | null;
  emailLowerCase?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  contactName?: string | null;
  phone?: string | null;
  source?: string | null;
  tags?: string[];
  dateAdded?: string | null;
  dateUpdated?: string | null;
  attributions?: GHLAttribution[];
  customFields?: Array<{ id: string; value?: string }>;
}

export interface GHLSearchResult {
  contacts: GHLContact[];
  total: number;
}

function getCreds() {
  const token = process.env.GHL_API_TOKEN;
  const locationId = process.env.GHL_LOCATION_ID;
  if (!token) {
    throw new Error(
      "GHL_API_TOKEN is not set. Add it to Vercel env vars (Production).",
    );
  }
  if (!locationId) {
    throw new Error(
      "GHL_LOCATION_ID is not set. Add it to Vercel env vars (Production).",
    );
  }
  return { token, locationId };
}

function buildHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    Version: API_VERSION,
    Accept: "application/json",
    "Content-Type": "application/json",
  };
}

/**
 * Search contacts by tag. Returns all matching contacts across pages.
 * Bails out at MAX_CONTACTS_PER_SYNC to avoid runaway requests on a
 * misconfigured tag (e.g., if someone sets tag = "lead").
 */
const MAX_CONTACTS_PER_SYNC = 5000;
const PAGE_SIZE = 100;

export async function searchContactsByTag(
  tag: string,
  opts: { locationId?: string } = {},
): Promise<GHLSearchResult> {
  const { token, locationId: defaultLoc } = getCreds();
  const locationId = opts.locationId ?? defaultLoc;

  const all: GHLContact[] = [];
  let page = 1;
  let total = 0;

  while (true) {
    const body = {
      locationId,
      pageLimit: PAGE_SIZE,
      page,
      filters: [
        {
          field: "tags",
          operator: "contains",
          value: tag,
        },
      ],
    };

    const res = await fetch(`${BASE}/contacts/search`, {
      method: "POST",
      headers: buildHeaders(token),
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(
        `GHL search failed (${res.status}): ${text.slice(0, 500)}`,
      );
    }

    const json = (await res.json()) as {
      contacts?: GHLContact[];
      total?: number;
    };
    const batch = json.contacts ?? [];
    total = json.total ?? all.length + batch.length;
    all.push(...batch);

    // Stop conditions: empty page, hit max, or fetched everything
    if (batch.length === 0) break;
    if (all.length >= total) break;
    if (all.length >= MAX_CONTACTS_PER_SYNC) {
      console.warn(
        `[GHL] Hit MAX_CONTACTS_PER_SYNC (${MAX_CONTACTS_PER_SYNC}) — truncating sync. Tag=${tag}`,
      );
      break;
    }
    page += 1;
    // Mild throttle to stay well under rate limits
    await new Promise((r) => setTimeout(r, 100));
  }

  return { contacts: all, total };
}

/**
 * Returns first attribution entry if present. GHL stores attributions as
 * an array (one per session/form-fill); we pick the earliest for source-
 * of-truth attribution, falling back to the only one if there's just one.
 */
export function firstAttribution(
  contact: GHLContact,
): GHLAttribution | null {
  const a = contact.attributions;
  if (!a || a.length === 0) return null;
  return a[0];
}

export function bestEmail(contact: GHLContact): string | null {
  return (
    contact.emailLowerCase?.toLowerCase() ||
    contact.email?.toLowerCase() ||
    null
  );
}

export function bestName(contact: GHLContact): string | null {
  if (contact.contactName?.trim()) return contact.contactName.trim();
  const fn = contact.firstName?.trim() || "";
  const ln = contact.lastName?.trim() || "";
  const joined = `${fn} ${ln}`.trim();
  return joined || null;
}

// =============================================================
// Automations tab — GHL workflow listing (the two subaccounts)
// =============================================================
// The Automations tab tracks GHL workflows across TWO subaccounts, each its
// own location + Private Integration Token (per the feature brief). Because
// GHL caps Private Integration Tokens at 5 per location, the MAIN subaccount
// REUSES the existing Campaigns token rather than burning a new slot; the b2b
// subaccount uses its own:
//   - "ghl"      (main) → GHL_API_TOKEN     / GHL_LOCATION_ID   (shared w/ Campaigns)
//   - "ghl-b2b"  (sub)  → GHL_B2B_API_TOKEN / GHL_B2B_LOCATION_ID
// The token MUST carry the "View Workflows" (workflows.readonly) scope, or the
// workflows endpoint returns 403. We only ever READ here, so sharing the
// Campaigns token (and never changing its value) doesn't affect Campaigns.
// GHL's API does NOT reliably expose per-run history, so the Automations sync
// tracks NAME + STATUS only (Last Runtime stays "-" for GHL) — by design
// (brief §3.2 / §3.4).

/** Per-subaccount creds for the Automations GHL sync. Null when unconfigured. */
function getGhlAutomationCreds(
  slug: string,
): { token: string; locationId: string } | null {
  let token: string | undefined;
  let locationId: string | undefined;
  if (slug === "ghl") {
    token = process.env.GHL_API_TOKEN;
    locationId = process.env.GHL_LOCATION_ID;
  } else if (slug === "ghl-b2b") {
    token = process.env.GHL_B2B_API_TOKEN;
    locationId = process.env.GHL_B2B_LOCATION_ID;
  }
  if (!token || !locationId) return null;
  return { token, locationId };
}

/**
 * Live-verify a GHL subaccount's creds actually work for workflows (used by the
 * Main Page card's "check status" button). Makes a tiny authenticated workflows
 * request; returns true only on a 200. Returns false when the subaccount is
 * unconfigured, the token is invalid/revoked, the token lacks the
 * workflows.readonly scope (403), or the request errors.
 */
export async function verifyGhlAutomations(slug: string): Promise<boolean> {
  const creds = getGhlAutomationCreds(slug);
  if (!creds) return false;
  try {
    const res = await fetch(
      `${BASE}/workflows/?locationId=${encodeURIComponent(creds.locationId)}`,
      { headers: buildHeaders(creds.token) },
    );
    return res.ok;
  } catch {
    return false;
  }
}

/** A workflow as returned by GET /workflows/ (only the fields we use). */
interface GHLWorkflow {
  id?: string;
  name?: string;
  status?: string;
}

/** A workflow normalized into the shape our sync wants (mirrors MakeAutomation). */
export interface GHLAutomation {
  /** Workflow id on GHL (the external id). */
  id: string;
  /** Workflow name (Column 1 in the table). */
  name: string;
  /** Deep link to the workflow on GHL — the row's identity (unique). */
  url: string;
  /** "active" | "paused" derived from the workflow's `status`. */
  status: "active" | "paused";
}

/** Deep link to a workflow in the GHL app — this is the row's identity. */
export function ghlWorkflowUrl(locationId: string, workflowId: string): string {
  return `https://app.gohighlevel.com/v2/location/${locationId}/automation/workflows/builder/${workflowId}`;
}

/**
 * List every workflow in a GHL subaccount, normalized for the sync. GHL returns
 * all workflows for a location in a single `{ workflows: [...] }` response (no
 * cursor pagination on this endpoint). Status maps GHL's `published` -> "active",
 * anything else (draft/unknown) -> "paused". GHL exposes NO per-run history, so
 * the sync never sets a last-run (Last Runtime stays "-" for GHL).
 */
export async function listGhlAutomations(
  slug: string,
): Promise<GHLAutomation[]> {
  const creds = getGhlAutomationCreds(slug);
  if (!creds) {
    throw new Error(`GHL creds for "${slug}" are not configured.`);
  }
  const { token, locationId } = creds;

  const res = await fetch(
    `${BASE}/workflows/?locationId=${encodeURIComponent(locationId)}`,
    { headers: buildHeaders(token) },
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `GHL workflows request failed (${res.status}): ${text.slice(0, 500)}`,
    );
  }

  const json = (await res.json()) as { workflows?: GHLWorkflow[] };
  const out: GHLAutomation[] = [];
  for (const w of json.workflows ?? []) {
    if (!w.id) continue; // no id -> can't build the identity URL
    out.push({
      id: w.id,
      name: (w.name ?? "").trim(),
      url: ghlWorkflowUrl(locationId, w.id),
      status: w.status === "published" ? "active" : "paused",
    });
  }
  return out;
}
