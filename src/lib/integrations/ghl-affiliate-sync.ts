// =============================================================
// GHL B2B subaccount sync — mirror affiliate partners to GoHighLevel
// =============================================================
// Pushes our approved/active affiliate partners into the dedicated B2B
// GoHighLevel subaccount as contacts (one contact per partner, keyed by
// email), tagged "affiliate-partner". RefCode, status, and lifetime paid
// commission ride along as custom fields + a structured note so the
// non-technical B2B team can see partner health inside GHL.
//
// Auth + location (see also ghl-client.ts §Automations):
//   - GHL_B2B_API_TOKEN     — Private Integration Token for the B2B subaccount
//                             (must carry contacts.write scope). Falls back to
//                             GHL_API_TOKEN only if the B2B token is unset.
//   - GHL_B2B_LOCATION_ID   — the B2B subaccount's location id (REQUIRED).
//
// v2 API quirks (mirrors ghl-client.ts):
//   - Authorization: Bearer pit-...  + Version: 2021-07-28 header (REQUIRED)
//   - Upsert endpoint: POST /contacts/upsert  — dedupes by locationId+email,
//     creates or updates and returns { contact: { id, ... }, new: bool }.
//     (Documented GHL v2 endpoint; assumption noted here since ghl-client.ts
//     only ever READ before.)
//   - Custom fields on upsert use the array form
//     [{ key | id, field_value }]; we use the `key` form (custom field unique
//     keys must be pre-created in the subaccount). If a key doesn't exist GHL
//     silently ignores it, so the note carries the same data as a safety net.
//
// DEFENSIVE: if the token or location id is missing we return
// { skipped: true, reason } WITHOUT throwing, so the cron is a no-op until
// the env vars are configured. Per-contact errors are caught so one bad
// upsert never aborts the whole run.
// =============================================================

import { db } from "@/lib/db";
import { partners, partnerConversions } from "@/lib/db/schema";
import { eq, and, or, sql } from "drizzle-orm";

const BASE = "https://services.leadconnectorhq.com";
const API_VERSION = "2021-07-28";
const AFFILIATE_TAG = "affiliate-partner";

/** Custom field unique keys expected in the B2B subaccount (see header note). */
const CF_REF_CODE = "affiliate_ref_code";
const CF_STATUS = "affiliate_status";
const CF_LIFETIME_PAID = "affiliate_lifetime_paid_usd";

export interface GhlSyncSummary {
  synced: number;
  skipped: number;
  errors: number;
  /** Only set when the whole run is a no-op (missing creds). */
  reason?: string;
}

/** Minimal partner shape the upsert needs (works for full rows too). */
export interface SyncablePartner {
  id: string;
  name: string;
  email: string;
  company?: string | null;
  refCode: string;
  status: string;
  ghlContactId?: string | null;
}

function getCreds(): { token: string; locationId: string } | null {
  // Prefer the dedicated B2B token; fall back to the shared token only so a
  // partial config (B2B location set, token shared) still works.
  const token = process.env.GHL_B2B_API_TOKEN || process.env.GHL_API_TOKEN;
  const locationId = process.env.GHL_B2B_LOCATION_ID;
  if (!token || !locationId) return null;
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

function centsToUsd(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

/**
 * Upsert a single partner into the B2B GHL subaccount. Keyed by email, tagged
 * "affiliate-partner", carrying refCode / status / lifetime paid commission as
 * both custom fields and a note. Returns the GHL contact id on success.
 *
 * DEFENSIVE: returns { skipped: true, reason } if creds are missing rather than
 * throwing. Network / API failures throw so the caller can count them.
 *
 * @param partner    the partner to mirror
 * @param lifetimePaidCents  sum of paid commission cents (defaults to 0)
 */
export async function syncAffiliateToGhl(
  partner: SyncablePartner,
  lifetimePaidCents = 0,
): Promise<
  | { skipped: true; reason: string }
  | { skipped: false; contactId: string | null }
> {
  const creds = getCreds();
  if (!creds) {
    return {
      skipped: true,
      reason:
        "GHL_B2B_LOCATION_ID and/or GHL_B2B_API_TOKEN (or GHL_API_TOKEN) not set",
    };
  }
  const { token, locationId } = creds;

  const [firstName, ...rest] = (partner.name || "").trim().split(/\s+/);
  const lastName = rest.join(" ") || undefined;

  const noteBody = [
    `Affiliate partner (synced from CAIO affiliate system).`,
    `Ref code: ${partner.refCode}`,
    `Status: ${partner.status}`,
    `Lifetime paid commission: ${centsToUsd(lifetimePaidCents)}`,
  ].join("\n");

  const body: Record<string, unknown> = {
    locationId,
    email: partner.email,
    firstName: firstName || undefined,
    lastName,
    name: partner.name || undefined,
    companyName: partner.company || undefined,
    tags: [AFFILIATE_TAG],
    source: "CAIO affiliate sync",
    customFields: [
      { key: CF_REF_CODE, field_value: partner.refCode },
      { key: CF_STATUS, field_value: partner.status },
      { key: CF_LIFETIME_PAID, field_value: centsToUsd(lifetimePaidCents) },
    ],
  };

  const res = await fetch(`${BASE}/contacts/upsert`, {
    method: "POST",
    headers: buildHeaders(token),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `GHL upsert failed (${res.status}) for ${partner.email}: ${text.slice(0, 300)}`,
    );
  }

  const json = (await res.json()) as {
    contact?: { id?: string };
    id?: string;
  };
  const contactId = json.contact?.id ?? json.id ?? null;

  // Attach the structured note (best-effort — failure here doesn't fail the
  // upsert, since the custom fields already carry the same data).
  if (contactId) {
    try {
      await fetch(`${BASE}/contacts/${contactId}/notes`, {
        method: "POST",
        headers: buildHeaders(token),
        body: JSON.stringify({ body: noteBody }),
      });
    } catch (err) {
      console.warn(
        `[ghl-affiliate-sync] note attach failed for ${partner.email}:`,
        err,
      );
    }

    // Persist the GHL contact id back so future runs / admin UI can deep-link.
    if (contactId !== partner.ghlContactId) {
      try {
        await db
          .update(partners)
          .set({ ghlContactId: contactId, updatedAt: new Date() })
          .where(eq(partners.id, partner.id));
      } catch (err) {
        console.warn(
          `[ghl-affiliate-sync] failed to persist ghlContactId for ${partner.email}:`,
          err,
        );
      }
    }
  }

  return { skipped: false, contactId };
}

/**
 * Mirror every approved/active partner (excluding samples) to the B2B GHL
 * subaccount. Computes each partner's lifetime PAID commission in one grouped
 * query, then upserts each contact. Per-contact errors are caught and counted
 * so a single failure never aborts the run.
 *
 * DEFENSIVE: returns { synced:0, skipped:0, errors:0, reason } without throwing
 * when creds are missing.
 */
export async function syncAllAffiliates(): Promise<GhlSyncSummary> {
  const creds = getCreds();
  if (!creds) {
    return {
      synced: 0,
      skipped: 0,
      errors: 0,
      reason:
        "GHL_B2B_LOCATION_ID and/or GHL_B2B_API_TOKEN (or GHL_API_TOKEN) not set — skipping",
    };
  }

  // Approved/active, real (non-sample) partners only.
  const rows = await db
    .select({
      id: partners.id,
      name: partners.name,
      email: partners.email,
      company: partners.company,
      refCode: partners.refCode,
      status: partners.status,
      ghlContactId: partners.ghlContactId,
    })
    .from(partners)
    .where(
      and(
        or(eq(partners.status, "approved"), eq(partners.status, "active")),
        eq(partners.isSample, false),
      ),
    );

  // Lifetime PAID commission per partner, computed in a single grouped query.
  const paidRows = await db
    .select({
      partnerId: partnerConversions.partnerId,
      paidCents: sql<number>`coalesce(sum(${partnerConversions.commissionCents}), 0)::int`,
    })
    .from(partnerConversions)
    .where(eq(partnerConversions.status, "paid"))
    .groupBy(partnerConversions.partnerId);

  const paidByPartner = new Map<string, number>();
  for (const r of paidRows) {
    if (r.partnerId) paidByPartner.set(r.partnerId, r.paidCents);
  }

  let synced = 0;
  let skipped = 0;
  let errors = 0;

  for (const p of rows) {
    if (!p.email) {
      skipped += 1;
      continue;
    }
    try {
      const result = await syncAffiliateToGhl(
        p,
        paidByPartner.get(p.id) ?? 0,
      );
      if (result.skipped) {
        // Creds vanished mid-run — bail with what we have.
        return { synced, skipped, errors, reason: result.reason };
      }
      synced += 1;
    } catch (err) {
      errors += 1;
      console.error(
        `[ghl-affiliate-sync] upsert failed for ${p.email}:`,
        err,
      );
    }
    // Mild throttle to stay under GHL rate limits.
    await new Promise((r) => setTimeout(r, 100));
  }

  return { synced, skipped, errors };
}
