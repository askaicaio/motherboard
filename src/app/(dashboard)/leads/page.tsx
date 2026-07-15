// AI Readiness leads — server component gates auth, then hands off to the
// client table which fetches /api/leads (keeps the shared token server-side).

import { requireAuth } from "@/lib/auth/guard";
import { LeadsPageClient } from "@/components/leads/leads-page-client";

export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  await requireAuth();
  return <LeadsPageClient />;
}
