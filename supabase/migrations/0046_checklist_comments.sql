-- ============================================================================
-- 0046_checklist_comments.sql
-- Threaded comments per affiliate testing-guide checklist item. Idempotent.
-- ============================================================================

CREATE TABLE IF NOT EXISTS affiliate_checklist_comments (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id    text NOT NULL,
  user_id    uuid NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  body       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_affiliate_checklist_comments_item
  ON affiliate_checklist_comments(item_id);
