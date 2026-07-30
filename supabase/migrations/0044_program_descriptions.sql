-- ============================================================================
-- 0044_program_descriptions.sql
-- Populate the enroll-card `description` for each public program. These mirror
-- the canonical PROGRAM_DESCRIPTIONS used on the Stripe checkout pages so the
-- /enroll cards and Stripe checkout read the same. Only fills blanks — never
-- overwrites a description an admin has already set. Idempotent.
-- ============================================================================

UPDATE partner_programs SET description =
  'A focused engagement that builds a clear AI investment thesis — connecting AI initiatives to measurable business outcomes and ROI accountability.'
WHERE slug = 'roi-blueprint' AND (description IS NULL OR description = '');

UPDATE partner_programs SET description =
  'An executive certification that builds the knowledge and credibility leaders need to govern AI strategy, manage risk, and drive responsible adoption.'
WHERE slug = 'ai-leadership-certification' AND (description IS NULL OR description = '');

UPDATE partner_programs SET description =
  'A rigorous executive certification for senior leaders taking formal responsibility for AI strategy, governance, and enterprise-wide AI transformation.'
WHERE slug = 'caio-certification' AND (description IS NULL OR description = '');

UPDATE partner_programs SET description =
  'A concentrated leadership intensive that rapidly orients your executive team around AI strategy and governance fundamentals.'
WHERE slug = 'ai-leadership-kickstart-day' AND (description IS NULL OR description = '');

-- $1 end-to-end test product (pre-seeded in 0024 as slug 'test-product-1').
UPDATE partner_programs SET description =
  'A $1 end-to-end test purchase — use it to verify checkout, affiliate attribution, and payouts without spending real money.'
WHERE slug = 'test-product-1' AND (description IS NULL OR description = '');
