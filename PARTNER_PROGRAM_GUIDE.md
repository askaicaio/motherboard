# CAIO Partner Program — Team Guide

> **Audience:** Cedric (presenting the system) and any team member who needs to understand, operate, or support the affiliate program.  
> **Last updated:** 2026-06-23

---

## Table of Contents

1. [What Is the Partner Program?](#1-what-is-the-partner-program)
2. [Why We Built It Custom (Not GHL Affiliate Manager)](#2-why-we-built-it-custom)
3. [The Partner Journey End-to-End](#3-the-partner-journey-end-to-end)
4. [How Attribution Works](#4-how-attribution-works)
5. [Commission Rules in Plain English](#5-commission-rules-in-plain-english)
6. [Tour of the Staff Admin Surfaces](#6-tour-of-the-staff-admin-surfaces)
7. [Setup Checklist](#7-setup-checklist)
8. [FAQ](#8-faq)

---

## 1. What Is the Partner Program?

The CAIO Partner Program is our custom-built affiliate system that lets trusted partners (coaches, consultants, alumni, and referral contacts) earn a commission when they introduce us to a buyer who then purchases a CAIO program.

**In one sentence:** a partner shares their unique link or makes a direct introduction → someone buys a CAIO program → the partner earns 10% of the commissionable amount → we pay them Net-45 via ACH or Zelle once they pass a $100 minimum.

### Programs in scope

| Program | List Price | Default Commission (10%) |
|---|---|---|
| ROI Blueprint | $10,000 | $1,000 |
| AI Leadership Certification | $12,000 | $1,200 |
| CAIO Certification | $12,000 | $1,200 |
| AI Leadership Kickstart Day | $12,000 | $1,200 |
| Strategic Oversight *(sales-led)* | $43,500 | $4,350 |
| Embedded Fractional CAIO *(sales-led)* | $54,000 | $5,400 |

> **Important:** commission is calculated on the *commissionable* amount — list price minus setup fees and Stripe passthrough fees — not the list price itself. In most cases the difference is small, but the math is always explicit in the conversion record.

---

## 2. Why We Built It Custom

**Not GHL Affiliate Manager.** GHL's built-in affiliate manager is fine for basic link tracking but has critical gaps for our business:

| Problem with GHL Affiliate Manager | How our system solves it |
|---|---|
| No first-attribution-wins logic | We record the first valid attribution event and lock it — a second click by the same prospect does not re-assign the partner |
| Cannot track sales-led (non-checkout) deals | Admins log a `direct_intro` attribution event manually for phone/email-closed deals |
| No new-customer gate | `customers_index` table seeds every prior buyer; commission is only paid if the buyer is a genuine net-new customer AND this is their first purchase |
| No refund-window hold | Commissions sit in `pending` for 7 days; if a refund or chargeback is raised in that window the commission is automatically reversed |
| No audit trail | Every status transition writes an immutable event row; you can replay the full history of any conversion |
| GHL payout tools are unreliable | We generate a CSV batch, export it, and pay via ACH or Zelle manually — simple and auditable |
| Cannot enforce W-9/W-8BEN before payout | Partner's `taxFormStatus` must be `w9`, `w8ben`, or `w8bene` or the payout batch excludes them |

---

## 3. The Partner Journey End-to-End

```
Apply → Review → Approve → Get Link → Share → Someone Buys → Conversion
  → Pending (7-day refund window) → Earned → Payout Batch → Paid
```

### Step-by-step

**1. Application**  
A potential partner fills out the public form at `/apply` (no login required). Their record lands in the `partners` table with `status = applied`. The team gets a notification and can review it in **Applications** inside the admin dashboard.

**2. Approval**  
An admin reviews the application and clicks **Approve** (or **Decline** with a reason). On approval the partner's status becomes `approved`, `approvedAt` is set, and the system generates an 8-character base62 `refCode`.

**3. Getting the referral link**  
Once approved the partner receives their unique referral link:

```
https://chiefaiofficer.com/r?aff=<refCode>
```

This link redirects to the main site and drops a `aff_id` cookie valid for 60 days.

**4. Sharing the link / making intros**  
- **Self-serve programs** (ROI Blueprint, certifications, Kickstart Day): the partner shares their link. Any click creates a `partnerClicks` record and sets the browser cookie.  
- **Sales-led programs** (Strategic Oversight, Embedded Fractional CAIO): there is no checkout page. Instead, when a partner emails us saying "I'm introducing you to Acme Corp", an admin logs a `direct_intro` attribution event with the prospect's name, email, and company. This must be logged *before* a proposal goes out — see [attribution rules](#4-how-attribution-works).

**5. The prospect buys via Stripe checkout**  
When a prospect completes a Stripe checkout, the webhook `checkout.session.completed` fires. Our handler:
1. Reads the `aff_id` value passed through Stripe metadata.
2. Looks up the matching attribution event (first-attribution-wins).
3. Checks `customers_index` — if the email already appears, `isNewCustomer = false` and no commission is earned.
4. Creates a `partnerConversions` row with `status = pending` and sets `refundWindowEndsAt = purchasedAt + 7 days`.

**6. Pending → Earned (7-day refund window)**  
A nightly job (or manual trigger) checks every `pending` conversion where `refundWindowEndsAt < now`. If no refund or chargeback has arrived it flips the row to `status = earned` and sets `earnedAt`.

If a refund arrives: `charge.refunded` webhook fires, a **clawback** row is inserted (negative `commissionCents`), and the original row flips to `reversed`.

**7. Earned → Paid (Net-45 payout)**  
Each month an admin goes to **Payouts**, clicks **Generate Draft Batch** for the period. The system sums all `earned` conversions (including any negative clawback rows) for partners who have:
- A valid tax form (`w9` / `w8ben` / `w8bene`)
- A payout method set (`ach` or `zelle`)
- Total ≥ $100

The admin exports the CSV, pays each partner manually via ACH or Zelle, then marks the batch **Paid**. All included conversions flip to `status = paid`.

---

## 4. How Attribution Works

### The referral link

```
https://chiefaiofficer.com/r?aff=<refCode>
```

1. Browser hits `/r?aff=<refCode>`.
2. The server validates the `refCode`, logs a `partnerClicks` row (IP, user-agent, landing path).
3. Sets an `aff_id=<partnerId>` cookie with a 60-day expiry.
4. Redirects to the main site (or a program landing page).

When the prospect checks out, Stripe metadata includes `aff_id`. Our webhook reads it and creates the attribution event.

### First-attribution-wins

If a prospect clicks Partner A's link on Day 1 and Partner B's link on Day 5, and then buys on Day 10, **Partner A wins**. We do not re-assign attribution once an event is recorded for a given `(prospect email, is_valid=true)` pair.

### Direct intros (sales-led)

For Strategic Oversight and Embedded Fractional CAIO the sales conversation happens over calls and email — there is no checkout link. Instead:

1. Partner emails Cedric: "I'm introducing you to Jane Smith at Acme Corp."
2. Admin logs a `direct_intro` attribution event: prospect name, email, company, date.
3. **Critical:** this must be logged BEFORE the proposal goes out. If the event is logged after `proposalSentAt` the system marks it `isValid = false` and it never wins attribution matching.
4. When the deal closes and we collect payment manually, an admin creates a `manual` conversion and links it to the attribution event.

### The new-customer gate

Commission is only earned if:
- The buyer's email is NOT already in `customers_index` at the time of purchase.
- AND this is the buyer's first purchase (we insert their email into `customers_index` at conversion time with `ON CONFLICT DO NOTHING`).

This prevents partners from claiming commissions on renewals or repeat buyers.

---

## 5. Commission Rules in Plain English

| Rule | Detail |
|---|---|
| **Rate** | 10% flat (default). Individual programs can override this via `commissionRateOverride` on the `partnerPrograms` row. |
| **Basis** | `grossCents − feesCents − nonCommissionableCents` = `commissionableCents`. Commission = `commissionableCents × rate`. NOT the list price. |
| **Cookie window** | 60 days from first click. If the prospect buys after 60 days the cookie has expired and no commission is earned. |
| **Refund window** | 7 days from purchase. If refunded in that window the commission is reversed (clawback row). |
| **Minimum payout** | $100 per partner per batch. Partners below $100 carry forward to the next batch. |
| **Payout terms** | Net-45 — payment is made approximately 45 days after the end of the month the commission was earned. |
| **Payment methods** | ACH bank transfer or Zelle. No PayPal, checks, or crypto. |
| **Tax forms required** | US partners must submit a W-9. Non-US must submit W-8BEN (individual) or W-8BEN-E (entity). No valid tax form = no payout (commission accrues but is held). |
| **New customers only** | Commission only on net-new buyers. Existing customers (in `customers_index`) do not generate commissions. |
| **Sales-led intros** | Must be logged before the proposal goes out. |

---

## 6. Tour of the Staff Admin Surfaces

All surfaces live under `/partner-program/` in the Motherboard dashboard. You need to be logged in as an admin.

### Overview (`/partner-program`)

The landing page you see when you click "Partner Program" in the sidebar.

**What it shows:**
- **Active Partners** — partners with status `active` or `approved`.
- **Pending Conversions** — conversions in `pending` status waiting for the refund window to clear.
- **Earned (unpaid)** — total commission dollars earned but not yet in a paid batch.
- **Paid to Date** — lifetime commission paid out.
- Quick-link cards to every sub-page.
- Recent conversions table (last 8).

**Common actions:** scan for unusual numbers, click through to the relevant sub-page.

---

### Partners (`/partner-program/partners`)

A table of all approved/active/suspended/terminated partners.

**What it shows:** name, email, company, ref code, status, tax form status, payout method, notes, approved date.

**Common actions:**
- View a partner's details and edit their notes or payout info.
- Suspend or terminate a partner.
- Copy their referral link.
- See their lifetime earnings.

---

### Applications (`/partner-program/applications`)

New applications that haven't been reviewed yet (`status = applied`).

**What it shows:** applicant name, email, company, applied date, and any notes they submitted.

**Common actions:**
- **Approve** — moves status to `approved`, generates `refCode`, triggers welcome email.
- **Decline** — moves status to `declined`, optionally records a decline reason.

> Look out for the orange badge on the quick-link card on the Overview page — it shows how many applications are waiting.

---

### Attribution (`/partner-program/attribution`)

All attribution events — both `tracked_link` (from clicks) and `direct_intro` (admin-logged).

**What it shows:** partner, type, prospect name/email/company, recorded date, whether it's valid, proposal sent date (for intros).

**Common actions:**
- Log a new `direct_intro` for a sales-led deal.
- Invalidate an event (e.g., the intro came in after the proposal was already sent).
- Add notes to an event.

---

### Conversions (`/partner-program/conversions`)

The commission ledger. Every purchase that triggered a commission attempt.

**What it shows:** buyer email, program, partner, gross, fees, commissionable amount, commission, status, purchase date.

**Status meanings:**

| Status | Meaning |
|---|---|
| `pending` | Inside the 7-day refund window. Do not pay yet. |
| `earned` | Refund window passed, commission is owed. |
| `paid` | Included in a paid payout batch. |
| `reversed` | A refund or clawback cancelled the commission. |
| `rejected` | Admin rejected the conversion (e.g., fraud, ineligible buyer). |

**Common actions:**
- Manually match an unmatched conversion to a partner.
- Reject a conversion with a reason.
- Initiate a clawback (creates a negative-commission row).
- View the full audit trail of a conversion.

> The orange badge on the Overview quick-link shows `pending` conversions that may need attention (e.g., buyer disputes, refund review).

---

### Payouts (`/partner-program/payouts`)

Batch management for monthly commission payments.

**Common actions:**
1. **Generate Draft** — pick the period (YYYYMM), system calculates net commissions per partner (including clawbacks), excludes partners below $100 or missing tax forms.
2. **Export CSV** — download a file with partner name, email, payout method, Zelle handle or bank info, and amount.
3. Pay each partner manually via ACH or Zelle.
4. **Mark Paid** — flips all included conversions to `paid` and records `paidAt`.

**Batches are permanent records** — never delete a batch. If you made an error, create a correcting conversion or clawback row and include it in the next batch.

---

### Disputes (`/partner-program/disputes`)

Partners can submit a dispute if they believe a conversion was misattributed or a rejection was incorrect. This creates a `partnerDisputes` row.

**What it shows:** partner, linked conversion (if any), submitted date, evidence text, status, resolution.

**Status meanings:**

| Status | Meaning |
|---|---|
| `open` | Needs review. |
| `upheld` | We agreed with the partner and corrected the conversion. |
| `denied` | We reviewed and the original decision stands. |
| `closed` | Resolved for other reasons (e.g., partner withdrew). |

**Common actions:** read the evidence, decide upheld/denied, add a resolution note, change the linked conversion's status if the dispute is upheld.

---

### Settings (`/partner-program/settings`)

Global program configuration. Every change creates a new `partnerSettings` row (append-only history).

| Setting | Default | Notes |
|---|---|---|
| Cookie window | 60 days | How long after a click the attribution is valid |
| Default commission rate | 10% (0.10) | Per-program overrides beat this |
| Refund window | 7 days | Commission held pending for this long after purchase |
| Payout terms | 45 days | Net-45 from month-end |
| Minimum payout | $100 (10000 cents) | Partners below this carry forward |

> Changing settings here only affects future conversions. Historical commissions use the settings that were in effect at the time of `purchasedAt`.

---

## 7. Setup Checklist

Work through these steps in order before the Partner Program goes live.

### Infrastructure

- [ ] **Run Supabase migrations 0017 and 0018** — these create all the `partners`, `partner_programs`, `partner_conversions`, etc. tables. Run via the Supabase SQL editor or `npx drizzle-kit migrate`.
- [ ] **Seed the initial programs** — insert the 6 programs from §1 (ROI Blueprint, certifications, Kickstart Day, Strategic Oversight, Embedded Fractional CAIO) into `partner_programs`. Set `salesLed = true` for the last two.
- [ ] **Seed initial settings** — insert one row into `partner_settings` with the defaults (60-day cookie, 10% rate, 7-day refund, Net-45, $100 min).

### Stripe

- [ ] **Add `STRIPE_SECRET_KEY`** in Vercel environment variables (Settings → Environment Variables). Use the restricted key with `read:checkout_sessions` and `read:charges`.
- [ ] **Add `STRIPE_WEBHOOK_SECRET`** — generated when you create the webhook endpoint in the Stripe dashboard.
- [ ] **Create Stripe webhook endpoint** pointing to `https://b2b.chiefaiofficer.com/api/partners/stripe-webhook` with these events:
  - `checkout.session.completed`
  - `charge.refunded`
  - `charge.dispute.created`
- [ ] **Verify Stripe metadata** — confirm your Stripe checkout sessions include `aff_id` in the metadata when the cookie is present. Check the Stripe integration code at `src/lib/integrations/ghl-client.ts` and the checkout creation flow.

### Domains

- [ ] **Map `b2b.chiefaiofficer.com`** — the main Motherboard dashboard. Add the CNAME in your DNS provider pointing to your Vercel deployment.
- [ ] **Map `affiliates.chiefaiofficer.com`** — the future partner-facing portal (once built). Add to Vercel project → Domains.
- [ ] **Add `PARTNER_PROGRAM_BASE_URL=https://chiefaiofficer.com`** in Vercel environment variables. This is the base for referral links (`https://chiefaiofficer.com/r?aff=<refCode>`).

### Customer Index Seed

- [ ] **Import prior buyers** via the GHL integration endpoint:
  ```
  POST /api/partners/customers-import/ghl
  ```
  This reads all contacts from GHL who have made a purchase and inserts their emails into `customers_index` with `source = 'ghl'`. Run it once before launch. Check the logs in Vercel for success/error counts.
- [ ] **Optionally import Circle + Stripe history** — if you have CSVs of prior Circle or Stripe buyers, import them manually into `customers_index` with `source = 'circle'` or `source = 'stripe'`.

### Communications

- [ ] **Draft the partner welcome email** in GHL — sent when an admin approves an application. Include the partner's referral link, commission rate, cookie window, and a link to the partner portal.
- [ ] **Draft the partner onboarding guide** — a shorter version of §3–§5 above written for partners (not staff). Link to it in the welcome email.

### Testing

- [ ] **Create a test partner** with a known `refCode`.
- [ ] **Click the test referral link** and confirm a `partnerClicks` row appears and the `aff_id` cookie is set.
- [ ] **Complete a test Stripe checkout** (use Stripe test mode) and verify the conversion appears in the Conversions table with `status = pending`.
- [ ] **Trigger the refund-window job** manually and confirm the conversion flips to `earned`.
- [ ] **Generate a test payout batch** and verify the CSV output is correct.

---

## 8. FAQ

**Q: Can a partner earn commission on their own purchase?**  
A: No. The partner's own email is in `customers_index` from their application. When the conversion is created, `isNewCustomer = false` and no commission is generated. An admin reviewing a conversion that looks self-referral should reject it with a note.

**Q: What happens if a partner's link is shared widely and 100 people click it but only 1 buys?**  
A: That's fine — clicks are logged but don't create commissions. Only a completed purchase creates a conversion row.

**Q: A prospect clicked two different partners' links. Who gets credit?**  
A: The first one. First-attribution-wins. The second click's `aff_id` cookie does not overwrite the first because our attribution matching finds the earliest valid event for that prospect email.

**Q: The partner says they introduced a client but forgot to log a direct_intro. Can we back-date it?**  
A: You can log it now, but the system will automatically mark `isValid = false` if the proposal has already been sent. The event is stored for audit purposes but never wins attribution matching. If you believe the partner genuinely made the intro first, use the admin override to manually match the conversion to them (with a note explaining why).

**Q: A refund came in after the 7-day refund window. Do we claw back the commission?**  
A: The system does not automatically claw back after the refund window. An admin can manually initiate a clawback from the Conversions detail page. Use judgment: if the refund is due to fraud or a program error on our side, clawback. If the client simply changed their mind months later and we agreed, it's a business decision.

**Q: Can a partner earn commission on a program renewal?**  
A: No. Renewals involve an existing customer, so `isNewCustomer = false` at the time of checkout (their email is already in `customers_index` from the original purchase). No commission is generated.

**Q: A partner hasn't submitted their W-9. Can we just pay them anyway?**  
A: No. IRS rules require a W-9 (US person) or W-8BEN/W-8BEN-E (non-US person) before making payments to third parties. The payout batch generator automatically excludes partners without a valid tax form. Their commissions accrue and carry forward until they submit the form.

**Q: How do I add a new program to the Partner Program?**  
A: Insert a row into `partner_programs` (via the Settings page or directly in Supabase). Set `listValueCents`, `setupFeeCents`, `salesLed`, and optionally `commissionRateOverride`. If it has a Stripe checkout, also set `stripeProductId` and `stripePriceId` — the webhook uses the product ID to look up which program a conversion belongs to.

**Q: Where do I find a partner's referral link?**  
A: In the Partners admin page, open the partner's detail view. The link is displayed there and can be copied. The format is always `https://chiefaiofficer.com/r?aff=<refCode>`.

**Q: What is the "dispute window" vs the "refund window"?**  
A: The **refund window** (7 days) is when commission is held in `pending`. The **dispute window** (14 days from purchase) is how long a *partner* can formally dispute a conversion decision (e.g., they believe a rejection was wrong). Both windows are stored on every conversion row.

---

*Questions? Slack Cedric or open a ClickUp task under the Partner Program project.*
