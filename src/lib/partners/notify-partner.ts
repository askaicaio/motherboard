// =============================================================
// Affiliate-facing in-app notifications — the single write path.
//
// notifyPartner() creates ONE partner_notifications row for a single affiliate
// (the recipient is always that affiliate — no settings/subscriber lookup, unlike
// the staff notifyProgramEvent). Best-effort: any failure is logged and
// swallowed so it can never break the action that fired it.
//
// This is the affiliate-side counterpart to notifyProgramEvent (which notifies
// STAFF). A single business event may call BOTH — they write to separate tables
// on opposite sides of the staff/partner auth boundary.
// =============================================================

import { db } from "@/lib/db";
import { partnerNotifications } from "@/lib/db/schema";

export async function notifyPartner(p: {
  partnerId: string;
  /** Event key, e.g. 'conversion' | 'payout' | 'dispute' | 'message'. */
  type: string;
  title: string;
  body?: string;
  /** Relative PORTAL path the notification opens (e.g. /portal/activity). */
  linkHref?: string;
}): Promise<void> {
  try {
    await db.insert(partnerNotifications).values({
      partnerId: p.partnerId,
      type: p.type,
      title: p.title,
      body: p.body ?? null,
      linkHref: p.linkHref ?? null,
    });
  } catch (err) {
    console.error("[notifications] notifyPartner failed:", err);
  }
}
