-- Sample affiliate data for the admin UI + a ready-to-use demo login.
-- Idempotent: re-running is a no-op (ON CONFLICT DO NOTHING on natural keys).
-- Demo login → email: demo@chiefaiofficer.com  password: CaioDemo2026!

-- ── Affiliates ───────────────────────────────────────────────────────────────
INSERT INTO "partners"
  ("id", "ref_code", "name", "email", "company", "status",
   "tax_form_status", "payout_method", "password_hash", "must_change_password",
   "country", "audience_size", "application_data", "applied_at", "approved_at")
VALUES
  -- Demo account (active, loginable, no forced change so you can sign right in)
  ('a0000000-0000-0000-0000-00000000d001', 'DEMO2026', 'Demo Affiliate',
   'demo@chiefaiofficer.com', 'CAIO Demo Co', 'active', 'w9', 'ach',
   '$2b$10$Y6.z4e4glnuuz76xSjes8uRrYL0fZFXZNR148aN6B/6nGa6IDzBLS', false,
   'United States', 24000, '{}'::jsonb, now() - interval '60 days', now() - interval '58 days'),

  ('a0000000-0000-0000-0000-00000000a002', 'JORDAN01', 'Jordan Avery',
   'jordan.sample@example.com', 'Avery Media', 'active', 'w9', 'zelle',
   NULL, false, 'United States', 8500, '{}'::jsonb, now() - interval '40 days', now() - interval '38 days'),

  ('a0000000-0000-0000-0000-00000000a003', 'MORGAN01', 'Morgan Diaz',
   'morgan.sample@example.com', 'Diaz Advisory', 'active', 'w8ben', 'ach',
   NULL, false, 'Canada', 41000, '{}'::jsonb, now() - interval '35 days', now() - interval '33 days'),

  -- Pending applications (populate the Applications tab)
  ('a0000000-0000-0000-0000-00000000a004', 'pending_seed_004', 'Alex Romero',
   'alex.applicant@example.com', 'Romero Consulting', 'applied', 'none', 'none',
   NULL, false, 'United States', 15000,
   '{"howDidYouHear":"LinkedIn","profession":"Fractional COO","promoExperience":true,"affiliateExperienceLevel":"Intermediate","aiExperienceLevel":"Advanced","platforms":["LinkedIn","Email List"],"targetAudience":["Executives","Online Business Owners"]}'::jsonb,
   now() - interval '3 days', NULL),

  ('a0000000-0000-0000-0000-00000000a005', 'pending_seed_005', 'Sam Patel',
   'sam.applicant@example.com', 'Patel Growth', 'applied', 'none', 'none',
   NULL, false, 'United Kingdom', 62000,
   '{"howDidYouHear":"Referral","profession":"Newsletter operator","promoExperience":true,"affiliateExperienceLevel":"Expert","aiExperienceLevel":"Intermediate","platforms":["Email List","YouTube","Podcast"],"targetAudience":["Online Business Owners","Biz Opp"]}'::jsonb,
   now() - interval '1 days', NULL),

  ('a0000000-0000-0000-0000-00000000a006', 'pending_seed_006', 'Taylor Brooks',
   'taylor.applicant@example.com', NULL, 'applied', 'none', 'none',
   NULL, false, 'United States', 3200,
   '{"howDidYouHear":"Google","profession":"AI consultant","promoExperience":false,"affiliateExperienceLevel":"Beginner","aiExperienceLevel":"Expert","platforms":["LinkedIn","Blog"],"targetAudience":["Government Agencies","Executives"]}'::jsonb,
   now() - interval '6 hours', NULL)
ON CONFLICT ("email") DO NOTHING;

-- ── Payout batch (paid) ──────────────────────────────────────────────────────
INSERT INTO "partner_payout_batches"
  ("id", "period_yyyymm", "status", "total_cents", "generated_at", "paid_at")
VALUES
  ('b0000000-0000-0000-0000-00000000b001', 202605, 'paid', 640000,
   now() - interval '45 days', now() - interval '40 days')
ON CONFLICT ("id") DO NOTHING;

-- ── Conversions (the central ledger; mixed statuses) ─────────────────────────
INSERT INTO "partner_conversions"
  ("id", "partner_id", "buyer_email", "program_id", "gross_cents", "fees_cents",
   "non_commissionable_cents", "commissionable_cents", "commission_cents",
   "external_order_id", "source", "purchased_at", "is_new_customer", "status",
   "refund_window_ends_at", "dispute_window_ends_at", "earned_at", "payout_batch_id")
VALUES
  -- Demo: paid (in the paid batch)
  ('c0000000-0000-0000-0000-00000000c001', 'a0000000-0000-0000-0000-00000000d001',
   'buyer.one@acme.com', (SELECT id FROM partner_programs WHERE slug='roi-blueprint'),
   1000000, 0, 0, 1000000, 100000, 'seed-conv-001', 'stripe',
   now() - interval '50 days', true, 'paid',
   now() - interval '43 days', now() - interval '36 days', now() - interval '43 days',
   'b0000000-0000-0000-0000-00000000b001'),

  -- Demo: earned (cleared, awaiting next payout)
  ('c0000000-0000-0000-0000-00000000c002', 'a0000000-0000-0000-0000-00000000d001',
   'buyer.two@globex.com', (SELECT id FROM partner_programs WHERE slug='ai-leadership-certification'),
   1200000, 0, 0, 1200000, 120000, 'seed-conv-002', 'stripe',
   now() - interval '20 days', true, 'earned',
   now() - interval '13 days', now() - interval '6 days', now() - interval '13 days', NULL),

  -- Demo: pending (still in refund window)
  ('c0000000-0000-0000-0000-00000000c003', 'a0000000-0000-0000-0000-00000000d001',
   'buyer.three@initech.com', (SELECT id FROM partner_programs WHERE slug='caio-certification'),
   1200000, 0, 0, 1200000, 120000, 'seed-conv-003', 'stripe',
   now() - interval '2 days', true, 'pending',
   now() + interval '5 days', now() + interval '12 days', NULL, NULL),

  -- Jordan: earned
  ('c0000000-0000-0000-0000-00000000c004', 'a0000000-0000-0000-0000-00000000a002',
   'buyer.four@umbrella.com', (SELECT id FROM partner_programs WHERE slug='roi-blueprint'),
   1000000, 0, 0, 1000000, 100000, 'seed-conv-004', 'stripe',
   now() - interval '18 days', true, 'earned',
   now() - interval '11 days', now() - interval '4 days', now() - interval '11 days', NULL),

  -- Morgan: paid sales-led Embedded Fractional CAIO (manual entry, in the paid batch)
  ('c0000000-0000-0000-0000-00000000c005', 'a0000000-0000-0000-0000-00000000a003',
   'buyer.five@soylent.com', (SELECT id FROM partner_programs WHERE slug='embedded-fractional-caio'),
   5400000, 0, 0, 5400000, 540000, 'seed-conv-005', 'manual',
   now() - interval '52 days', true, 'paid',
   now() - interval '45 days', now() - interval '38 days', now() - interval '45 days',
   'b0000000-0000-0000-0000-00000000b001'),

  -- Demo: reversed (refunded within window)
  ('c0000000-0000-0000-0000-00000000c006', 'a0000000-0000-0000-0000-00000000d001',
   'buyer.six@hooli.com', (SELECT id FROM partner_programs WHERE slug='ai-leadership-kickstart-day'),
   1200000, 0, 0, 1200000, 120000, 'seed-conv-006', 'stripe',
   now() - interval '9 days', true, 'reversed',
   now() - interval '2 days', now() + interval '5 days', NULL, NULL)
ON CONFLICT ("source", "external_order_id") DO NOTHING;

-- ── Disputes ─────────────────────────────────────────────────────────────────
INSERT INTO "partner_disputes"
  ("id", "partner_id", "conversion_id", "submitted_at", "deal_close_date",
   "evidence", "status")
VALUES
  ('d0000000-0000-0000-0000-00000000e001', 'a0000000-0000-0000-0000-00000000a002',
   NULL, now() - interval '5 days', now() - interval '10 days',
   'Introduced this client via email on the 2nd — forwarding the thread and the calendar invite for the intro call.',
   'open'),
  ('d0000000-0000-0000-0000-00000000e002', 'a0000000-0000-0000-0000-00000000d001',
   'c0000000-0000-0000-0000-00000000c006', now() - interval '3 days', now() - interval '9 days',
   'The refund was processed in error — the customer re-purchased the next day under a different email.',
   'open')
ON CONFLICT ("id") DO NOTHING;

-- ── Clicks (so the demo dashboard shows traffic) ─────────────────────────────
INSERT INTO "partner_clicks" ("id", "partner_id", "ref_code", "cookie_id", "landing_path", "created_at")
SELECT gen_random_uuid(), 'a0000000-0000-0000-0000-00000000d001', 'DEMO2026', gen_random_uuid(),
       '/partners', now() - (g || ' hours')::interval
FROM generate_series(1, 37) AS g
WHERE NOT EXISTS (
  SELECT 1 FROM partner_clicks WHERE partner_id = 'a0000000-0000-0000-0000-00000000d001'
);
