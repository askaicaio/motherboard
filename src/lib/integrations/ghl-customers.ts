// =============================================================
// GHL → customers_index pull (prior-buyers seed)
// =============================================================
// Sources the new-customer gate from GoHighLevel's PAYMENTS data, NOT
// contacts — GHL contacts carry no native "has paid" flag, only the
// payments/orders + payments/transactions endpoints do (verified against
// GoHighLevel's official OpenAPI specs).
//
// For each location we pull paid orders + succeeded transactions, take
// contactEmail + createdAt, and keep the EARLIEST createdAt per email as
// the first-purchase date. Run per sub-account and union the results —
// a "new customer" (Terms §3.2) is anyone with no prior CAIO purchase
// across ALL sub-accounts.
//
// API contract (services.leadconnectorhq.com, Version: 2021-07-28):
//   GET /payments/orders?altId={loc}&altType=location&paymentStatus=paid&limit&offset
//       → { data: [{ contactEmail, createdAt, status, ... }], totalCount }
//   GET /payments/transactions?altId={loc}&altType=location&limit&offset
//       → { data: [{ contactEmail, createdAt, status, ... }], totalCount }
//       (no status query param — filter "succeeded" client-side)
// =============================================================

const BASE = "https://services.leadconnectorhq.com";
const API_VERSION = "2021-07-28";
const PAGE_SIZE = 100;
const MAX_RECORDS = 100000; // runaway guard

export interface GhlBuyer {
  email: string;
  firstPurchaseAt: Date;
}

interface PaymentRow {
  contactEmail?: string | null;
  createdAt?: string | null;
  status?: unknown; // string or object per the spec
}

function headers(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    Version: API_VERSION,
    Accept: "application/json",
  };
}

/** Status may be a string ("succeeded") or a small object — normalize. */
function statusString(status: unknown): string {
  if (typeof status === "string") return status.toLowerCase();
  if (status && typeof status === "object") {
    const v =
      (status as Record<string, unknown>).status ??
      (status as Record<string, unknown>).value;
    if (typeof v === "string") return v.toLowerCase();
  }
  return "";
}

async function pullPaged(
  path: string,
  token: string,
  locationId: string,
  extraParams: Record<string, string>,
  keepRow: (row: PaymentRow) => boolean,
): Promise<PaymentRow[]> {
  const rows: PaymentRow[] = [];
  let offset = 0;
  while (rows.length < MAX_RECORDS) {
    const url = new URL(`${BASE}${path}`);
    url.searchParams.set("altId", locationId);
    url.searchParams.set("altType", "location");
    url.searchParams.set("limit", String(PAGE_SIZE));
    url.searchParams.set("offset", String(offset));
    for (const [k, v] of Object.entries(extraParams)) {
      url.searchParams.set(k, v);
    }

    const res = await fetch(url.toString(), { headers: headers(token) });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(
        `GHL ${path} failed (${res.status}): ${text.slice(0, 400)}`,
      );
    }
    const json = (await res.json()) as {
      data?: PaymentRow[];
      totalCount?: number;
    };
    const batch = json.data ?? [];
    for (const row of batch) {
      if (keepRow(row)) rows.push(row);
    }
    const total = json.totalCount ?? offset + batch.length;
    offset += PAGE_SIZE;
    if (batch.length === 0 || offset >= total) break;
    await new Promise((r) => setTimeout(r, 100)); // gentle throttle
  }
  return rows;
}

/**
 * Pull all paid buyers (email + earliest purchase date) from one GHL
 * sub-account, merging paid orders and succeeded transactions.
 */
export async function pullGhlBuyers(
  token: string,
  locationId: string,
): Promise<GhlBuyer[]> {
  const [orders, transactions] = await Promise.all([
    pullPaged(
      "/payments/orders",
      token,
      locationId,
      { paymentStatus: "paid" },
      (r) => !!r.contactEmail,
    ),
    pullPaged(
      "/payments/transactions",
      token,
      locationId,
      {},
      (r) => !!r.contactEmail && statusString(r.status) === "succeeded",
    ),
  ]);

  // Merge, keeping the earliest createdAt per email.
  const earliest = new Map<string, Date>();
  for (const row of [...orders, ...transactions]) {
    const email = row.contactEmail?.trim().toLowerCase();
    if (!email || !email.includes("@")) continue;
    const when = row.createdAt ? new Date(row.createdAt) : null;
    if (!when || isNaN(when.getTime())) continue;
    const prev = earliest.get(email);
    if (!prev || when.getTime() < prev.getTime()) {
      earliest.set(email, when);
    }
  }

  return Array.from(earliest.entries()).map(([email, firstPurchaseAt]) => ({
    email,
    firstPurchaseAt,
  }));
}

/** Per-subaccount creds. Reuses the existing Automations/Campaigns env names. */
export function getGhlSubaccountCreds(
  subaccount: "main" | "b2b",
): { token: string; locationId: string } | null {
  let token: string | undefined;
  let locationId: string | undefined;
  if (subaccount === "main") {
    token = process.env.GHL_API_TOKEN || process.env.GHL_API_KEY;
    locationId = process.env.GHL_LOCATION_ID;
  } else {
    token = process.env.GHL_B2B_API_TOKEN;
    locationId = process.env.GHL_B2B_LOCATION_ID;
  }
  if (!token || !locationId) return null;
  return { token, locationId };
}
