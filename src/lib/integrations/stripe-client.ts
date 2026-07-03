// =============================================================
// Stripe client (Partner Program checkout + webhooks)
// =============================================================
// Singleton Stripe SDK instance. Reads the secret key from env,
// accepting either STRIPE_SECRET_KEY (canonical) or STRIPE_API_KEY
// (the name the key was added under in Vercel) so we don't hit the
// same name-mismatch that bit the GHL token.
//
// apiVersion is intentionally NOT pinned — the installed SDK defaults
// to the version it was built against, which matches the account.
// =============================================================

import Stripe from "stripe";

let cached: Stripe | null = null;

export function stripeSecret(): string | null {
  return process.env.STRIPE_SECRET_KEY || process.env.STRIPE_API_KEY || null;
}

export function getStripe(): Stripe {
  if (cached) return cached;
  const key = stripeSecret();
  if (!key) {
    throw new Error(
      "Stripe key missing — set STRIPE_SECRET_KEY (or STRIPE_API_KEY) in Vercel env vars.",
    );
  }
  cached = new Stripe(key);
  return cached;
}

export function webhookSecret(): string | null {
  return process.env.STRIPE_WEBHOOK_SECRET || null;
}

export type StripeMode = "test" | "live" | "unset";

/**
 * Detect whether the configured Stripe key is a TEST or LIVE key, purely from
 * its prefix (sk_test_/rk_test_ vs sk_live_/rk_live_). Returns "unset" when no
 * key is configured. Never throws — safe to call from any server component to
 * render a "TEST / LIVE" indicator.
 */
export function stripeMode(): StripeMode {
  const key = stripeSecret();
  if (!key) return "unset";
  if (key.includes("_test_")) return "test";
  if (key.includes("_live_")) return "live";
  return "unset";
}
