// Partner Program — Settings (campaign config) + program editor.
// Server component: loads the latest effective partnerSettings version
// and all partnerPrograms, then hands off to the interactive client.

import { db } from "@/lib/db";
import {
  partnerSettings,
  partnerPrograms,
  customersIndex,
} from "@/lib/db/schema";
import { desc, sql } from "drizzle-orm";
import { requireAuth } from "@/lib/auth/guard";
import { SettingsClient } from "@/components/partner-program/settings-client";

export const dynamic = "force-dynamic";

export default async function PartnerSettingsPage() {
  await requireAuth();

  const [latest] = await db
    .select()
    .from(partnerSettings)
    .orderBy(desc(partnerSettings.effectiveFrom))
    .limit(1);

  const programs = await db
    .select()
    .from(partnerPrograms)
    .orderBy(partnerPrograms.name);

  const [{ count: customersIndexCount }] = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(customersIndex);

  return (
    <SettingsClient
      customersIndexCount={customersIndexCount}
      settings={
        latest
          ? {
              id: latest.id,
              cookieWindowDays: latest.cookieWindowDays,
              defaultCommissionRate: latest.defaultCommissionRate,
              refundWindowDays: latest.refundWindowDays,
              payoutTermsDays: latest.payoutTermsDays,
              minPayoutCents: latest.minPayoutCents,
              payoutDayOfMonth: latest.payoutDayOfMonth,
              effectiveFrom: latest.effectiveFrom.toISOString(),
            }
          : null
      }
      programs={programs.map((p) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        listValueCents: p.listValueCents,
        commissionRateOverride: p.commissionRateOverride,
        salesLed: p.salesLed,
        active: p.active,
        stripeProductId: p.stripeProductId,
        stripePriceId: p.stripePriceId,
        setupFeeCents: p.setupFeeCents,
        stripeFeePassthroughCents: p.stripeFeePassthroughCents,
        isSample: p.isSample,
        archivedAt: p.archivedAt ? p.archivedAt.toISOString() : null,
      }))}
    />
  );
}
