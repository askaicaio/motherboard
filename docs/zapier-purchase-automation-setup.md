# Zapier purchase automation — setup guide

Every time someone completes a purchase on **/enroll**, Motherboard sends a
webhook to Zapier. Zapier then decides what to do based on **which product was
bought**:

| Product bought (`program_slug`) | What Zapier does |
| --- | --- |
| `ai-leadership-kickstart-day` | Emails the buyer as Dani (AI Kickstart welcome) |
| `roi-blueprint` | Emails the buyer as Dani (ROI Blueprint welcome) |
| `caio-certification` | Posts a Slack message to Katie |

Motherboard's own emails (the branded purchase confirmation to the buyer and the
handover alert to `onboarding@`) still send as well — Zapier is **additional**,
not a replacement.

---

## What Motherboard sends

A single flat JSON payload. Flat means Zapier shows each item as a simple field
you can drop into an email.

| Field | Example | Notes |
| --- | --- | --- |
| `event` | `purchase.completed` | Always this value |
| `occurred_at` | `2026-08-20T18:03:11.204Z` | UTC timestamp |
| `first_name` | `Jordan` | Falls back to `there` if Stripe has no name — safe to use in "Hi {first_name}," |
| `buyer_name` | `Jordan Avery` | May be empty |
| `buyer_email` | `jordan@example.com` | Who to email |
| `program_name` | `AI Leadership Kickstart Day` | Human title |
| `program_slug` | `ai-leadership-kickstart-day` | **Branch on this** — it never changes, unlike the name |
| `amount_formatted` | `$15,000.00` | What they actually paid |
| `amount_cents` | `1500000` | Same number, for maths |
| `currency` | `USD` | |
| `affiliate_code` | `DEMO2026` | The literal word `direct` when nobody referred them |
| `is_test_purchase` | `false` | `true` only for the $1 Test Product |
| `stripe_session_id` | `cs_live_a1b2…` | Useful for tracing back to Stripe |

> **Branch on `program_slug`, never on `program_name`.** Product names are
> editable in Motherboard (Affiliate Program → Settings → Affiliate Products &
> Services). If someone renames a product, a Zap keyed to the name breaks
> silently. The slug is fixed.

---

## Step 1 — Create the Zap and get the webhook URL

1. In Zapier, click **Create → Zaps**.
2. For the **Trigger**, search for and pick **Webhooks by Zapier**.
3. Event: **Catch Hook**. Click **Continue**.
4. Leave "Pick off a child key" blank. Click **Continue**.
5. Zapier shows **Your webhook URL** — something like
   `https://hooks.zapier.com/hooks/catch/14606520/abc123/`.
   **Copy it.** Leave this tab open.

## Step 2 — Give the URL to Motherboard

1. Go to the Vercel project → **Settings → Environment Variables**.
2. Add a new variable:
   - **Name:** `ZAPIER_PURCHASE_WEBHOOK_URL`
   - **Value:** the URL you copied
   - **Environments:** tick **Production** (and Preview if you want to test there)
3. Click **Save**.
4. **Redeploy** — environment variables only take effect on a new deployment
   (Deployments → latest → ⋯ → Redeploy).

If this variable isn't set, Motherboard simply skips the webhook. Nothing
breaks; the Zap just never fires.

## Step 3 — Send a test purchase

Zapier needs to see one real payload before it will let you build the rest.

1. Go to `https://affiliates.chiefaiofficer.com/enroll`.
2. Buy the **Test Product ($1)** with a real card (live mode — test cards won't
   work). You're charged $1 and auto-refunded $0.95 about a day later.
3. Back in Zapier, click **Test trigger**. You should see your purchase with
   all the fields above, and `is_test_purchase: true`.

> If nothing arrives: confirm you redeployed after adding the env var, and check
> the Vercel function logs for a line starting with `[zapier]`.

## Step 4 — Add the branches (Paths)

1. Click the **+** under the trigger and choose **Paths by Zapier**.
   (Paths need a paid Zapier plan. On the free plan, build three separate Zaps
   instead — same trigger URL, each with a Filter step in place of a Path.)

### Path A — AI Kickstart

**Rule:** `program_slug` **(Text) Exactly matches** `ai-leadership-kickstart-day`

**Action:** Gmail → **Send Email** (connect Dani's account, so it comes from her)

- **To:** `buyer_email`
- **From:** Dani's address
- **Subject:** `Welcome to the AI Kickstart, {{first_name}}`
- **Body:**

```
Hi {{first_name}},

Thank you for signing up for the AI Kickstart. We're excited to help you move from ideas around AI into a clear, practical plan for your business.

I'm Dani Apgar, Head of Partnerships, and I'll be working with you directly to coordinate your Kickstart and guide you through the next steps.

I'll reach out personally to schedule your session and make sure we have everything we need to get started.

If you have any questions before we connect, simply reply to this email or reach me directly on my personal cell at (858) 463-1130.

Looking forward to working with you!

Dani Apgar
Head of Partnerships
```

### Path B — ROI Blueprint

**Rule:** `program_slug` **(Text) Exactly matches** `roi-blueprint`

**Action:** Gmail → **Send Email** (Dani's account)

- **To:** `buyer_email`
- **Subject:** `Welcome to the ROI Blueprint, {{first_name}}`
- **Body:**

```
Hi {{first_name}},

Thank you for signing up for the ROI Blueprint. We're looking forward to helping you get clear on where AI can create the greatest measurable return in your business.

I'm Dani Apgar, Head of Partnerships, and I'll be working with you directly to coordinate your ROI Blueprint and make sure you know exactly what happens next.

I'll reach out personally to schedule your session and get everything set up.

In the meantime, if you have any questions or need anything before we connect, you can reply directly to this email or reach me on my personal cell at (858) 463-1130.

Looking forward to working with you!

Dani Apgar
Head of Partnerships
```

### Path C — CAIO Certification → Slack Katie

**Rule:** `program_slug` **(Text) Exactly matches** `caio-certification`

**Action:** Slack → **Send Direct Message**

- **To Username:** Katie — member ID `U08K1UTDXCP`
  (her DM conversation ID is `D08KNJ6KCMV` if Zapier asks for a channel instead)
- **Message Text:**

```
🎓 New CAIO Certification purchase

Client: {{buyer_name}} ({{buyer_email}})
Amount: {{amount_formatted}}
Referred by: {{affiliate_code}}

Over to you for the handover.
```

- Set **Send as a bot** to `no` if you want it to appear from the CAIO app.

> Want it in a team channel as well? Add a second Slack action — **Send Channel
> Message** — pick the channel, and include `<@U08K1UTDXCP>` in the text to
> @-mention Katie.

## Step 5 — Turn it on

Test each path, then **Publish** the Zap.

---

## Keeping it working

- **Adding a new product?** It won't email anyone until you add a Path for its
  slug. Find the slug in Motherboard → Affiliate Program → Settings → Affiliate
  Products & Services (the grey text under the product name).
- **Renaming a product is safe** — the slug doesn't change.
- **Retired products** (e.g. `ai-leadership-certification`) are archived and can
  no longer be purchased, so their paths will never fire.
- **Filtering out test runs:** every $1 Test Product purchase arrives with
  `is_test_purchase: true`. Since the paths match on real product slugs, test
  purchases already fall through without emailing anyone.
- **Sales-led products** (e.g. Embedded Fractional CAIO) don't go through
  checkout — buyers book a call instead — so they never trigger this webhook.
