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
