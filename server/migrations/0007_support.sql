-- Up Migration

-- Support issues raised from a meal (spec: "Report issue" on Meal Details).
CREATE TABLE support_issues (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  meal_order_id uuid REFERENCES meal_orders(id) ON DELETE SET NULL,
  category      text NOT NULL,
  description   text,
  status        text NOT NULL DEFAULT 'open'
                  CHECK (status IN ('open','investigating','resolved','rejected')),
  resolution    text,
  credit_paise  integer CHECK (credit_paise >= 0),
  resolved_at   timestamptz,
  resolved_by   text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER support_issues_updated_at BEFORE UPDATE ON support_issues
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX support_issues_user_idx ON support_issues (user_id, created_at DESC);
CREATE INDEX support_issues_open_idx ON support_issues (created_at) WHERE status IN ('open','investigating');

-- One rating per meal. The partial unique index is what stops a resubmitted
-- rating from scoring leaderboard points twice.
CREATE UNIQUE INDEX meal_orders_one_rating_idx ON meal_orders (id) WHERE rating IS NOT NULL;

-- Down Migration
DROP INDEX IF EXISTS meal_orders_one_rating_idx;
DROP TABLE IF EXISTS support_issues;
