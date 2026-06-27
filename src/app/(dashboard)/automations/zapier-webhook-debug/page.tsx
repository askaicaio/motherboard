// =============================================================
// TEMPORARY: Zapier webhook inspector page
// =============================================================
// Admin-only viewer for payloads captured by the public ingest endpoint
// (/api/zapier-webhook-debug/[secret]). Reachable by URL only — not linked in
// the sidebar. Delete this folder once we've confirmed what Zapier's
// "New Zap Error" trigger sends.
// =============================================================

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireAuth } from "@/lib/auth/guard";
import {
  getCaptures,
  WEBHOOK_DEBUG_INGEST_PATH,
} from "@/lib/automations/webhook-debug";
import { WebhookDebugClient } from "@/components/automations/webhook-debug-client";

export const dynamic = "force-dynamic";

export default async function ZapierWebhookDebugPage() {
  await requireAuth();
  const captures = await getCaptures();

  return (
    <div className="space-y-6 p-6">
      <Link
        href="/automations/zapier"
        className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Zapier
      </Link>

      <WebhookDebugClient
        initialCaptures={captures}
        ingestPath={WEBHOOK_DEBUG_INGEST_PATH}
      />
    </div>
  );
}
