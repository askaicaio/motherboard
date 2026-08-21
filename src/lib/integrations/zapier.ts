// =============================================================
// Zapier outbound webhooks
// =============================================================
// Fires a JSON payload at a Zapier "Catch Hook" URL so non-engineers can build
// automations (send an email as Dani, ping Slack, add a row to a sheet) without
// a deploy. The Zap branches on `program_slug`.
//
// The payload is deliberately FLAT — Zapier's field picker shows flat keys as
// simple, human-readable fields ("Program Slug", "First Name"), whereas nested
// objects turn into awkward `buyer__first_name` paths.
//
// Contract with callers: best-effort. Never throws, and never blocks for long —
// this runs inside the Stripe webhook handler, where an exception would return
// 500 and make Stripe retry an already-processed event, and a hang would risk
// the handler timing out. A missing URL is a silent no-op (integration off).
// =============================================================

/** Flat JSON body POSTed to Zapier when a purchase completes. */
export interface PurchaseWebhookPayload {
  event: "purchase.completed";
  occurred_at: string;
  /** Buyer's first name, or "there" — safe to drop straight into email copy. */
  first_name: string;
  buyer_name: string;
  buyer_email: string;
  /** Human product title, e.g. "AI Leadership Kickstart Day". */
  program_name: string;
  /** Stable identifier the Zap branches on, e.g. "roi-blueprint". */
  program_slug: string;
  amount_formatted: string;
  amount_cents: number;
  currency: string;
  /** Referring affiliate's code, or "" when the purchase was direct. */
  affiliate_code: string;
  /** True for the $1 sample/test product — lets a Zap path filter test runs. */
  is_test_purchase: boolean;
  stripe_session_id: string;
}

/** How long we'll wait on Zapier before giving up (Stripe expects a fast 200). */
const TIMEOUT_MS = 8000;

export function zapierPurchaseHookUrl(): string {
  return process.env.ZAPIER_PURCHASE_WEBHOOK_URL || "";
}

/**
 * POST a completed purchase to the Zapier catch hook. Best-effort: logs and
 * swallows every failure (unset URL, non-2xx, network error, timeout).
 */
export async function sendPurchaseWebhook(
  payload: PurchaseWebhookPayload,
): Promise<void> {
  const url = zapierPurchaseHookUrl();
  if (!url) return; // integration not configured — silent no-op

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Lets a Zap (or a proxy) recognize the source at a glance.
        "X-Motherboard-Event": payload.event,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error(
        `[zapier] purchase hook returned ${res.status}: ${detail.slice(0, 200)}`,
      );
      return;
    }
    console.info(
      `[zapier] purchase hook sent — ${payload.program_slug} / ${payload.buyer_email}`,
    );
  } catch (err) {
    console.error("[zapier] purchase hook failed:", err);
  }
}
