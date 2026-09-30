// AI Readiness leads — server component gates auth, then hands off to the
// client table which fetches /api/leads (keeps the shared token server-side).

import type { Metadata } from "next";
import { requireAuth } from "@/lib/auth/guard";
import { LeadsPageClient } from "@/components/leads/leads-page-client";

export const dynamic = "force-dynamic";

// Distinct tab title — the root layout has no template, so without this the
// page falls back to the generic "CAIO Internal Dashboard".
export const metadata: Metadata = { title: "Leads · Motherboard" };

export default async function LeadsPage() {
  await requireAuth();
  return <LeadsPageClient />;
}
