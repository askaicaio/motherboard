# Partner Program (affiliate system)

A fully-owned affiliate / referral system. We do **not** use GHL's Affiliate
Manager — it's UI-configured and can't be operated programmatically, which
would push setup, rule-enforcement, the portal, and exports onto staff as
ongoing manual work. This module owns the entire flow: click tracking,
attribution, the commission ledger, rule enforcement, payouts, and disputes.

## How attribution works (and its one hard dependency)

> **Reliable attribution depends on `aff_id` riding through to the purchase.**
> Anonymous-click email-matching is **best-effort only.**

The chain:

1. A partner shares `https://b2b.chiefaiofficer.com/r?aff=REF_CODE&dest=<landing>`.
2. `/r` logs a `partner_clicks` row, sets the HMAC-signed `caio_aff` cookie
   (scoped to the cookie window), and redirects to the landing page with
   `?aff_id=REF_CODE` appended.
3. The landing page's checkout CTA must carry `aff_id` into the Stripe
   Checkout Session (`POST /api/partners/checkout` does this — it writes the
   ref code to `client_reference_id`, `metadata.aff_id`, and
   `payment_intent_data.metadata.aff_id`).
4. On `checkout.session.completed`, the webhook reads `aff_id` and attributes
   the conversion directly.

If `aff_id` is present, attribution is **authoritative**. If it's missing, we
fall back to (a) the `caio_aff` cookie's `cookie_id` → click (with an age check
against the cookie window) and (b) email-matching the buyer against valid
`partner_attribution_events`. The email fallback can't recover a purely
anonymous click (clicks carry no email), so **partners and the landing page
must keep `aff_id` flowing through to checkout.**

## The single source-agnostic ingestion contract

Every conversion — Stripe, manual sales-led entry, future sources — goes
through `ingestConversion()` in `ingest.ts`. It is idempotent on
`(source, external_order_id)` at the DB layer, so Stripe webhook redeliveries
(at-least-once, possibly out of order) are safe.

Adapters that call it:

- **Stripe webhook** (`/api/stripe/webhook`) — `checkout.session.completed`
  ingests; `charge.refunded` (full) and `charge.dispute.created` reverse or
  clawback. We deliberately do **not** also handle `payment_intent.succeeded`
  (Checkout fires both — counting both double-counts).
- **Manual entry** (`/api/partners/manual-conversion`) — admin-only, for the
  sales-led programs (Strategic Oversight, Embedded Fractional CAIO) and
  corrections.

## The rules (binding, from the Terms + Playbook)

- **Commission basis (§3.3):** `commissionable = gross − fees − non_commissionable`,
  `commission = commissionable × rate`. **Never** computed on list price.
- **New-customer gate (§3.2):** commissionable only if the buyer email has no
  prior completed CAIO transaction (`customers_index` + prior conversions).
- **First-purchase-only (§3.1):** renewals/upgrades/expansions never commission.
- **Lifecycle (§4):** `pending → earned` once the refund window (default 7d)
  passes clean; refund/chargeback **in** window → `reversed`; refund/chargeback
  **after a paid commission** → `reversed` + a negative-cents clawback row that
  nets against future earned commissions.
- **First-attribution-wins (§5.3):** earliest `recorded_at` among eligible
  events; a documented `direct_intro` beats an expired cookie (the expired
  click is never an eligible candidate).
- **Direct-intro guard (Playbook §13):** an intro logged after `proposal_sent_at`
  is stored `is_valid=false` and never wins attribution.

Config (cookie window, rates, refund window, payout terms, min threshold) lives
in `partner_settings` (append-only history). Conversions read the row in effect
**as of `purchased_at`** — never a hardcoded constant.

## Seeding the new-customer gate

`customers_index` must list every prior CAIO buyer or the new-customer gate
can't fire. Two paths:

- **From GHL (recommended):** `POST /api/partners/customers-import/ghl`
  `{ subaccount: "both" }` pulls paid orders + succeeded transactions from both
  sub-accounts (`payments/orders?paymentStatus=paid` + `payments/transactions`),
  takes the earliest purchase per email, and upserts. GHL contacts carry no
  "has paid" flag — only the payments endpoints do, which is why we source from
  there.
- **From a CSV:** `scripts/import-customers-index.mjs` or
  `POST /api/partners/customers-import` (admin upload).

Both use `ON CONFLICT (email) DO NOTHING` — re-runs never clobber a
`first_purchase_at` a live conversion has already recorded.

## File map

| File | Role |
|---|---|
| `rules.ts` | Pure functions — commission math, rate resolution, window dates, attribution selection. Fully unit-tested. |
| `queries.ts` | DB helpers — active settings as-of, new-customer / first-purchase gates, program + partner resolution. |
| `ingest.ts` | `ingestConversion()` — the one source-agnostic entry point. |
| `lifecycle.ts` | State transitions — promote, reverse, clawback, mark-batch-paid. Every change writes a `partner_conversion_events` audit row. |
| `cookie.ts` | HMAC-signed `caio_aff` first-party cookie encode/decode. |
| `__tests__/` | Vitest unit tests for the rules engine + cookie. |
