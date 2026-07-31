-- ============================================================================
-- 0045_checklist_approvals.sql
-- Per-user approvals for the affiliate testing-guide checklist. Each row = one
-- staff member ticked one item. Everyone sees who approved each item; reset
-- only clears the current user's own rows. Idempotent.
-- ============================================================================

CREATE TABLE IF NOT EXISTS affiliate_checklist_approvals (
  user_id    uuid NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  item_id    text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, item_id)
);

CREATE INDEX IF NOT EXISTS idx_affiliate_checklist_item
  ON affiliate_checklist_approvals(item_id);
