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
