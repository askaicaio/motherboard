-- =============================================================
-- Subscriptions: parent/child nesting + auto-detection
-- =============================================================
-- Adds a self-reference so e.g. Claude Team Plan (doc@) owns the
-- individual seat rows (operations@, sales@, askai@, tech@, services@).
-- Children inherit billing from the parent and typically have NULL cost.
--
-- The post-add UPDATE walks every service_name with >1 rows and nests
-- zero-cost org-email children under the highest-cost org-email parent.
-- Non-org emails (e.g. doctordaigle@gmail.com) stay independent because
-- they're personal/separate billing, not seats on a team plan.
-- =============================================================

ALTER TABLE "subscriptions"
  ADD COLUMN IF NOT EXISTS "parent_id" uuid REFERENCES "subscriptions"("id") ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS "idx_subscriptions_parent_id" ON "subscriptions"("parent_id");

-- ---- Auto-detect parents and nest children --------------------------
-- For each service_name with multiple rows, the parent candidate is the
-- @chiefaiofficer.com row with the highest monthly_cost_usd (must be
-- > 50, otherwise it's not really a "main account").
--
-- Children are the OTHER @chiefaiofficer.com rows in the same service
-- group that have NULL or zero cost. Personal emails stay independent.

WITH parents AS (
  SELECT DISTINCT ON (service_name)
    service_name,
    id AS parent_id,
    monthly_cost_usd
  FROM subscriptions
  WHERE archived_at IS NULL
    AND service_name IS NOT NULL
    AND monthly_cost_usd IS NOT NULL
    AND monthly_cost_usd > 50
    AND (owner_email LIKE '%@chiefaiofficer.com' OR owner_email IS NULL)
  ORDER BY service_name, monthly_cost_usd DESC
),
groups_with_parents AS (
  SELECT service_name
  FROM subscriptions
  WHERE archived_at IS NULL AND service_name IS NOT NULL
  GROUP BY service_name
  HAVING COUNT(*) > 1
)
UPDATE subscriptions s
SET parent_id = p.parent_id,
    updated_at = now()
FROM parents p
JOIN groups_with_parents g ON g.service_name = p.service_name
WHERE s.service_name = p.service_name
  AND s.id <> p.parent_id
  AND s.archived_at IS NULL
  AND (s.monthly_cost_usd IS NULL OR s.monthly_cost_usd = 0)
  AND s.owner_email LIKE '%@chiefaiofficer.com'
  AND s.parent_id IS NULL;

-- Verify — how many got nested
SELECT
  COUNT(*) FILTER (WHERE parent_id IS NOT NULL) AS nested_children,
  COUNT(DISTINCT parent_id) FILTER (WHERE parent_id IS NOT NULL) AS distinct_parents
FROM subscriptions
WHERE archived_at IS NULL;
