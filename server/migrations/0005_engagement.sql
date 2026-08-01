-- Up Migration

CREATE TABLE rewards (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type                    text NOT NULL DEFAULT 'free_meal_day' CHECK (type IN ('free_meal_day','credit')),
  source                  text NOT NULL CHECK (source IN ('loyalty','referral','service_recovery')),
  status                  text NOT NULL DEFAULT 'earned'
                            CHECK (status IN ('earned','scheduled','redeemed','expired','revoked')),
  value_paise             integer,
  earned_at               timestamptz NOT NULL DEFAULT now(),
  expires_on              date NOT NULL,
  redeemed_at             timestamptz,
  redeemed_service_date   date,
  redeemed_meal_order_ids uuid[] NOT NULL DEFAULT '{}',
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER rewards_updated_at BEFORE UPDATE ON rewards
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX rewards_user_idx ON rewards (user_id, status);
CREATE INDEX rewards_expiry_sweep_idx ON rewards (expires_on) WHERE status = 'earned';

CREATE TABLE loyalty_periods (
  id                            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subscription_id               uuid REFERENCES subscriptions(id) ON DELETE SET NULL,
  period_start                  date NOT NULL,
  expected_qualification_date   date NOT NULL,
  active_days                   integer NOT NULL DEFAULT 0,
  required_active_days          integer NOT NULL DEFAULT 28,
  fulfilled_meal_days           integer NOT NULL DEFAULT 0,
  required_fulfilled_meal_days  integer NOT NULL DEFAULT 20,
  status                        text NOT NULL DEFAULT 'in_progress'
                                  CHECK (status IN ('in_progress','qualified','frozen','expired')),
  reward_id                     uuid REFERENCES rewards(id),
  qualified_at                  timestamptz,
  created_at                    timestamptz NOT NULL DEFAULT now(),
  updated_at                    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, period_start)
);

CREATE TRIGGER loyalty_periods_updated_at BEFORE UPDATE ON loyalty_periods
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Guarantees the evaluate-loyalty reconciler can only ever mint one reward per period.
CREATE UNIQUE INDEX loyalty_periods_one_reward_idx
  ON loyalty_periods (user_id, period_start) WHERE reward_id IS NOT NULL;

CREATE TABLE referrals (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id  uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referred_user_id  uuid REFERENCES users(id) ON DELETE SET NULL,
  code              text NOT NULL,
  status            text NOT NULL DEFAULT 'invited'
                      CHECK (status IN ('invited','signed_up','payment_pending',
                                        'qualified','rewarded','rejected','expired')),
  reward_id         uuid REFERENCES rewards(id),
  qualified_at      timestamptz,
  rewarded_at       timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER referrals_updated_at BEFORE UPDATE ON referrals
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX referrals_referrer_idx ON referrals (referrer_user_id, created_at DESC);
-- A referred user can only be attributed once.
CREATE UNIQUE INDEX referrals_referred_once_idx
  ON referrals (referred_user_id) WHERE referred_user_id IS NOT NULL;

CREATE TABLE leaderboard_periods (
  period      date PRIMARY KEY,
  closed_at   timestamptz,
  snapshot    jsonb
);

-- A points ledger, not a counter: reversible when a payment is reversed (§15.6).
CREATE TABLE leaderboard_points (
  id            bigserial PRIMARY KEY,
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  period        date NOT NULL,
  event_kind    text NOT NULL CHECK (event_kind IN ('meal_delivered','full_paid_week',
                                                    'meal_rated','referral_qualified','monthly_streak')),
  points        integer NOT NULL,
  source_type   text NOT NULL,
  source_id     uuid NOT NULL,
  reversed_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  -- Duplicate ratings cannot create duplicate points.
  UNIQUE (user_id, event_kind, source_type, source_id)
);

CREATE INDEX leaderboard_points_period_idx
  ON leaderboard_points (period, user_id) WHERE reversed_at IS NULL;

CREATE TABLE notification_preferences (
  user_id       uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  -- Operational channels; cannot be disabled while active deliveries exist (§11.2).
  delivery      boolean NOT NULL DEFAULT true,
  payment       boolean NOT NULL DEFAULT true,
  reminders     boolean NOT NULL DEFAULT true,
  nutrition     boolean NOT NULL DEFAULT true,
  rewards       boolean NOT NULL DEFAULT true,
  offers        boolean NOT NULL DEFAULT false,
  channels      jsonb NOT NULL DEFAULT '{"push":true,"whatsapp":true}'::jsonb,
  leaderboard_opt_in boolean NOT NULL DEFAULT true,
  appearance    text NOT NULL DEFAULT 'system' CHECK (appearance IN ('system','light','dark')),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER notification_preferences_updated_at BEFORE UPDATE ON notification_preferences
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE notifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category    text NOT NULL CHECK (category IN ('meal_updates','delivery_issues','payment_renewal',
                                                'subscription_updates','rewards_referrals','announcements')),
  title       text NOT NULL,
  body        text NOT NULL,
  deep_link   text,
  read_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX notifications_user_idx ON notifications (user_id, created_at DESC);
CREATE INDEX notifications_unread_idx ON notifications (user_id) WHERE read_at IS NULL;

-- Down Migration
DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS notification_preferences;
DROP TABLE IF EXISTS leaderboard_points;
DROP TABLE IF EXISTS leaderboard_periods;
DROP TABLE IF EXISTS referrals;
DROP TABLE IF EXISTS loyalty_periods;
DROP TABLE IF EXISTS rewards;
