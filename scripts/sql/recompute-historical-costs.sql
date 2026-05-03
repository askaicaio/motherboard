-- =============================================================
-- Recompute research_cost_usd for historical reports using
-- correct per-model pricing.
-- =============================================================
-- Background: prior to commit 1257d71, estimateCost() always used
-- Opus 4.7 prices ($15/M input, $75/M output). Reports run with
-- Sonnet 4.6 were therefore over-charged by ~5x in the displayed
-- cost. This script recomputes research_cost_usd using actual
-- per-model rates, based on the saved token counts.
--
-- Pricing (USD per 1M tokens) — must match MODEL_PRICING in
-- src/lib/inngest/functions/research-report.ts:
--   Opus 4.7/4.6:    $15  in / $75  out / $1.50 cache-read / $18.75 cache-write
--   Sonnet 4.6/4.5:  $3   in / $15  out / $0.30 cache-read / $3.75  cache-write
--   Haiku 4.5:       $0.80 in / $4  out / $0.08 cache-read / $1.00  cache-write
-- Plus: web_search_requests * $0.01
--
-- The script:
--   1. Shows what it WILL change (DRY RUN — uncomment the UPDATE below)
--   2. Logs old vs new for transparency
-- =============================================================

-- ---- Step 1: DRY RUN — preview what would change ----
SELECT
  id,
  company_name,
  research_model,
  research_input_tokens,
  research_output_tokens,
  research_cache_read_tokens,
  research_cache_creation_tokens,
  research_web_search_count,
  research_cost_usd AS old_cost_usd,
  ROUND(
    (
      -- Input tokens
      COALESCE(research_input_tokens, 0)::numeric *
        CASE
          WHEN research_model LIKE 'claude-opus-4-7%' THEN 15.0
          WHEN research_model LIKE 'claude-opus-4-6%' THEN 15.0
          WHEN research_model LIKE 'claude-sonnet-4-6%' THEN 3.0
          WHEN research_model LIKE 'claude-sonnet-4-5%' THEN 3.0
          WHEN research_model LIKE 'claude-haiku-4-5%' THEN 0.8
          ELSE 15.0  -- unknown → Opus pricing (safe over-estimate)
        END / 1000000.0
      +
      -- Output tokens
      COALESCE(research_output_tokens, 0)::numeric *
        CASE
          WHEN research_model LIKE 'claude-opus-4-7%' THEN 75.0
          WHEN research_model LIKE 'claude-opus-4-6%' THEN 75.0
          WHEN research_model LIKE 'claude-sonnet-4-6%' THEN 15.0
          WHEN research_model LIKE 'claude-sonnet-4-5%' THEN 15.0
          WHEN research_model LIKE 'claude-haiku-4-5%' THEN 4.0
          ELSE 75.0
        END / 1000000.0
      +
      -- Cache read tokens
      COALESCE(research_cache_read_tokens, 0)::numeric *
        CASE
          WHEN research_model LIKE 'claude-opus-4-7%' THEN 1.5
          WHEN research_model LIKE 'claude-opus-4-6%' THEN 1.5
          WHEN research_model LIKE 'claude-sonnet-4-6%' THEN 0.3
          WHEN research_model LIKE 'claude-sonnet-4-5%' THEN 0.3
          WHEN research_model LIKE 'claude-haiku-4-5%' THEN 0.08
          ELSE 1.5
        END / 1000000.0
      +
      -- Cache creation tokens
      COALESCE(research_cache_creation_tokens, 0)::numeric *
        CASE
          WHEN research_model LIKE 'claude-opus-4-7%' THEN 18.75
          WHEN research_model LIKE 'claude-opus-4-6%' THEN 18.75
          WHEN research_model LIKE 'claude-sonnet-4-6%' THEN 3.75
          WHEN research_model LIKE 'claude-sonnet-4-5%' THEN 3.75
          WHEN research_model LIKE 'claude-haiku-4-5%' THEN 1.0
          ELSE 18.75
        END / 1000000.0
      +
      -- Web searches @ $10 per 1k = $0.01 each
      COALESCE(research_web_search_count, 0)::numeric * 0.01
    )::numeric,
    4
  )::text AS new_cost_usd
FROM company_reports
WHERE research_status = 'complete'
  AND research_input_tokens IS NOT NULL
ORDER BY created_at DESC;

-- ---- Step 2: UPDATE — uncomment this block to apply the recompute ----
-- (Review the DRY RUN output above first, then uncomment + re-run)
--
-- UPDATE company_reports
-- SET research_cost_usd = ROUND(
--   (
--     COALESCE(research_input_tokens, 0)::numeric *
--       CASE
--         WHEN research_model LIKE 'claude-opus-4-7%' THEN 15.0
--         WHEN research_model LIKE 'claude-opus-4-6%' THEN 15.0
--         WHEN research_model LIKE 'claude-sonnet-4-6%' THEN 3.0
--         WHEN research_model LIKE 'claude-sonnet-4-5%' THEN 3.0
--         WHEN research_model LIKE 'claude-haiku-4-5%' THEN 0.8
--         ELSE 15.0
--       END / 1000000.0
--     +
--     COALESCE(research_output_tokens, 0)::numeric *
--       CASE
--         WHEN research_model LIKE 'claude-opus-4-7%' THEN 75.0
--         WHEN research_model LIKE 'claude-opus-4-6%' THEN 75.0
--         WHEN research_model LIKE 'claude-sonnet-4-6%' THEN 15.0
--         WHEN research_model LIKE 'claude-sonnet-4-5%' THEN 15.0
--         WHEN research_model LIKE 'claude-haiku-4-5%' THEN 4.0
--         ELSE 75.0
--       END / 1000000.0
--     +
--     COALESCE(research_cache_read_tokens, 0)::numeric *
--       CASE
--         WHEN research_model LIKE 'claude-opus-4-7%' THEN 1.5
--         WHEN research_model LIKE 'claude-opus-4-6%' THEN 1.5
--         WHEN research_model LIKE 'claude-sonnet-4-6%' THEN 0.3
--         WHEN research_model LIKE 'claude-sonnet-4-5%' THEN 0.3
--         WHEN research_model LIKE 'claude-haiku-4-5%' THEN 0.08
--         ELSE 1.5
--       END / 1000000.0
--     +
--     COALESCE(research_cache_creation_tokens, 0)::numeric *
--       CASE
--         WHEN research_model LIKE 'claude-opus-4-7%' THEN 18.75
--         WHEN research_model LIKE 'claude-opus-4-6%' THEN 18.75
--         WHEN research_model LIKE 'claude-sonnet-4-6%' THEN 3.75
--         WHEN research_model LIKE 'claude-sonnet-4-5%' THEN 3.75
--         WHEN research_model LIKE 'claude-haiku-4-5%' THEN 1.0
--         ELSE 18.75
--       END / 1000000.0
--     +
--     COALESCE(research_web_search_count, 0)::numeric * 0.01
--   )::numeric,
--   4
-- )::text,
-- updated_at = now()
-- WHERE research_status = 'complete'
--   AND research_input_tokens IS NOT NULL;
