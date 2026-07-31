# GHL Booking → Affiliate Attribution — Setup Runbook

**Goal:** when someone clicks an affiliate's link and books a call on your GHL
calendar, the affiliate gets credit for that lead in Motherboard (so when the
deal later closes, the commission attributes to them).

**How it works (plain English):** the affiliate link (`/r?aff=CODE`) tags the
visitor with `utm_content=CODE`. GHL stores that on the contact when they book.
A GHL **workflow** then sends the booking (email + the code) to a Motherboard
webhook, which records the lead. No money moves at booking time — the credit is
applied later when the sales deal closes.

You only set this up **once**. Three parts: a secret, a workflow, a test.

---

## Part 1 — Create the shared secret (5 min)

This is a password that proves the webhook call really came from your GHL (so
randoms can't POST fake attributions).

1. **Make up a long random secret.** Any random string works, e.g.
   `caio-ghl-9f3a7c2e5b8d41a6` (make your own — 20+ characters).
2. **Add it to Vercel:**
   - Go to **vercel.com** → your **motherboard** project → **Settings** →
     **Environment Variables**.
   - Click **Add New**. Key: `GHL_WEBHOOK_SECRET`. Value: the secret from step 1.
     Environment: **Production** (tick Preview too if you want).
   - Click **Save**.
3. **Redeploy** so the new variable takes effect: Vercel → **Deployments** →
   the latest one → **⋯** menu → **Redeploy**. (Env vars only apply after a
   deploy.)

Keep the secret handy — you paste the *same* value into GHL in Part 2.

---

## Part 2 — Build the GHL workflow (15 min)

### 2a. Confirm your affiliate booking link points at the GHL calendar

Affiliate links default to your booking calendar. Set the env var
`AFFILIATE_BOOKING_URL` in Vercel to your GHL calendar/funnel URL (same place as
Part 1, step 2). Example value: `https://link.chiefaiofficer.com/widget/booking/xxxxx`.
When an affiliate shares their link, `/r` adds `?utm_content=THEIRCODE` to it, and
GHL captures that automatically on the booking.

### 2b. Create the workflow

In GoHighLevel:

1. Go to **Automation** (left sidebar) → **Workflows** → **+ Create Workflow** →
   **Start from Scratch**.
2. **Add Trigger** → search **"Customer Booked Appointment"** → select it.
   - (Optional) Filter to the specific calendar affiliates send people to.
3. Click **+** to add an action → search **"Webhook"** → choose the
   **Webhook** action (sometimes labelled "Premium Action → Webhook").
4. Configure the webhook action:
   - **Method:** `POST`
   - **URL:**
     `https://motherboard.chiefaiofficer.com/api/partners/webhooks/ghl-booking`
   - **Headers** → add one header:
     - Key: `X-Webhook-Secret`
     - Value: *the exact secret from Part 1*
   - **Body / Custom Data** → set type to **JSON** and add these fields. Use the
     `{}` merge-field picker to insert the contact values:

     | Key           | Value (insert via the `{}` picker)                    |
     |---------------|-------------------------------------------------------|
     | `email`       | the contact's **Email**                               |
     | `utm_content` | the contact's **UTM Content** (under *Attribution*)   |
     | `first_name`  | the contact's **First Name**                          |
     | `last_name`   | the contact's **Last Name**                           |
     | `appointmentId` | the **Appointment Id**                              |

     Only `email` and `utm_content` are required; the rest just enrich the record.
5. **Save**, then toggle the workflow **Publish → On** (top right).

> **If you can't find a UTM Content merge field:** GHL stores UTMs under the
> contact's *Attribution*. If your version doesn't expose it directly, create a
> Contact **custom field** called "Affiliate Code," map `utm_content` into it on
> the booking calendar's settings, then send *that* custom field as `utm_content`
> in the webhook body. The webhook also accepts the keys `utmContent`, `affCode`,
> or `aff_id` if that's easier to map.

---

## Part 3 — Test it (5 min)

1. Open an affiliate link in a private/incognito window, e.g.
   `https://affiliates.chiefaiofficer.com/r?aff=TESTCODE` (use a real active
   affiliate's code). It should redirect you to the GHL booking calendar with
   `?utm_content=TESTCODE` in the URL.
2. Book a test appointment.
3. **Check it landed** in Motherboard: **Affiliate Program → Activity →
   Attribution** tab. You should see a new lead for that affiliate.

### Troubleshooting (what to look at)

- **Vercel logs are your friend.** Vercel → **motherboard** project → **Logs**
  (or **Runtime Logs**). Filter for `ghl-booking`. On every call the webhook
  prints a line like `[ghl-booking] keys: email,contact,appointment | contact
  keys: email,utm_content,...`. This shows you **exactly what GHL sent** — if
  `utm_content` isn't in that list, GHL isn't passing it and you need to fix the
  merge field in Part 2b.
- **401 in the logs** = the `X-Webhook-Secret` header value doesn't match
  `GHL_WEBHOOK_SECRET`. Re-check both are identical and that you redeployed
  after setting the env var.
- **200 but no lead appears** = the call worked but `utm_content` (or `email`)
  was empty. Fix the merge field mapping and re-test.

---

## Reference — what the webhook expects

- **Endpoint:** `POST /api/partners/webhooks/ghl-booking`
- **Auth:** header `X-Webhook-Secret: <GHL_WEBHOOK_SECRET>` (constant-time check)
- **Body (JSON):** `email` (required), `utm_content` (required — the affiliate
  code; also accepts `utmContent` / `affCode` / `aff_id`), plus optional
  `first_name`, `last_name`, `appointmentId`, `dateAdded`, `startTime`.
- **Behaviour:** records a `direct_intro` attribution event keyed on the
  prospect's email. Always returns `200` on a well-formed call (so GHL stops
  retrying); only a bad secret returns `401`. Reschedules are de-duped on the
  appointment id.
- Code: [`src/app/api/partners/webhooks/ghl-booking/route.ts`](../src/app/api/partners/webhooks/ghl-booking/route.ts)
