-- Up Migration

CREATE TABLE coupons (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code                  text NOT NULL UNIQUE,
  title                 text NOT NULL,
  description           text NOT NULL,
  kind                  text NOT NULL CHECK (kind IN ('flat','percent')),
  value_paise           integer CHECK (value_paise >= 0),
  percent_bps           integer CHECK (percent_bps BETWEEN 0 AND 10000),
  max_discount_paise    integer CHECK (max_discount_paise >= 0),
  min_order_paise       integer NOT NULL DEFAULT 0 CHECK (min_order_paise >= 0),
  applies_to_plan_codes text[] NOT NULL DEFAULT '{}',
  applies_to_kinds      text[] NOT NULL DEFAULT '{trial,subscription,renewal,resubscription}',
  new_users_only        boolean NOT NULL DEFAULT false,
  stackable_with_reward boolean NOT NULL DEFAULT false,
  usage_limit_total     integer,
  usage_limit_per_user  integer NOT NULL DEFAULT 1,
  starts_at             timestamptz NOT NULL DEFAULT now(),
  expires_at            timestamptz,
  is_active             boolean NOT NULL DEFAULT true,
  created_at            timestamptz NOT NULL DEFAULT now(),
  CHECK ((kind = 'flat'    AND value_paise IS NOT NULL)
      OR (kind = 'percent' AND percent_bps IS NOT NULL))
);

CREATE TABLE checkout_sessions (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind                    text NOT NULL CHECK (kind IN ('trial','subscription','renewal','resubscription')),
  step                    text NOT NULL DEFAULT 'review'
                            CHECK (step IN ('review','payment_method_required','payment_pending',
                                            'payment_success','payment_failed','expired')),
  source_type             text NOT NULL CHECK (source_type IN ('trial','subscription')),
  source_id               uuid NOT NULL,
  plan_id                 uuid REFERENCES subscription_plans(id),
  coupon_id               uuid REFERENCES coupons(id),
  reward_id               uuid,
  payment_method          text CHECK (payment_method IN ('upi','card','net_banking','wallet')),

  -- Price breakdown, backend-authoritative. The client never computes totals.
  plan_price_paise        integer NOT NULL DEFAULT 0 CHECK (plan_price_paise >= 0),
  delivery_charges_paise  integer NOT NULL DEFAULT 0 CHECK (delivery_charges_paise >= 0),
  taxes_paise             integer NOT NULL DEFAULT 0 CHECK (taxes_paise >= 0),
  discount_paise          integer NOT NULL DEFAULT 0 CHECK (discount_paise >= 0),
  trial_credit_paise      integer NOT NULL DEFAULT 0 CHECK (trial_credit_paise >= 0),
  reward_credit_paise     integer NOT NULL DEFAULT 0 CHECK (reward_credit_paise >= 0),
  total_payable_paise     integer NOT NULL DEFAULT 0 CHECK (total_payable_paise >= 0),

  -- Dev/staging only: selects the mock provider's webhook script.
  mock_scenario           text,
  expires_at              timestamptz,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER checkout_sessions_updated_at BEFORE UPDATE ON checkout_sessions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX checkout_sessions_user_idx ON checkout_sessions (user_id, created_at DESC);
CREATE INDEX checkout_sessions_open_idx ON checkout_sessions (user_id)
  WHERE step IN ('review','payment_method_required','payment_pending');

CREATE TABLE coupon_redemptions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id           uuid NOT NULL REFERENCES coupons(id),
  user_id             uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  checkout_session_id uuid NOT NULL REFERENCES checkout_sessions(id) ON DELETE CASCADE,
  discount_paise      integer NOT NULL CHECK (discount_paise >= 0),
  consumed_at         timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  -- Applying the same coupon twice to one checkout is a no-op, not a double discount.
  UNIQUE (coupon_id, checkout_session_id)
);

CREATE INDEX coupon_redemptions_usage_idx
  ON coupon_redemptions (coupon_id, user_id) WHERE consumed_at IS NOT NULL;

CREATE TABLE payments (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  checkout_session_id uuid NOT NULL REFERENCES checkout_sessions(id) ON DELETE CASCADE,
  provider            text NOT NULL CHECK (provider IN ('mock','razorpay','stripe','cashfree')),
  provider_order_id   text,
  provider_payment_id text,
  amount_paise        integer NOT NULL CHECK (amount_paise >= 0),
  currency            text NOT NULL DEFAULT 'INR',
  status              text NOT NULL DEFAULT 'created'
                        CHECK (status IN ('created','pending','authorized','captured','failed','refunded')),
  -- Monotonic guard so a late 'pending' webhook can never downgrade a 'captured'.
  status_rank         smallint NOT NULL DEFAULT 0,
  failure_code        text,
  failure_reason      text,
  last_event_at       timestamptz,
  idempotency_key     text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER payments_updated_at BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE UNIQUE INDEX payments_provider_payment_idx
  ON payments (provider, provider_payment_id) WHERE provider_payment_id IS NOT NULL;
CREATE INDEX payments_checkout_idx ON payments (checkout_session_id, created_at DESC);

-- Webhook dedupe. The PK is the whole mechanism: a duplicate delivery inserts zero
-- rows and the handler returns 200 without touching domain state.
CREATE TABLE provider_events (
  provider          text NOT NULL,
  provider_event_id text NOT NULL,
  raw               jsonb NOT NULL,
  received_at       timestamptz NOT NULL DEFAULT now(),
  processed_at      timestamptz,
  superseded        boolean NOT NULL DEFAULT false,
  error             text,
  PRIMARY KEY (provider, provider_event_id)
);

CREATE TABLE transactions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type            text NOT NULL CHECK (type IN ('payment','refund','credit','reward')),
  title           text NOT NULL,
  subtitle        text,
  -- Rewards are non-monetary rows: amount_paise is NULL and display_amount reads
  -- "Free meal day". Keeping both columns avoids encoding that as a fake number.
  amount_paise    integer,
  display_amount  text,
  status          text NOT NULL CHECK (status IN ('pending','succeeded','failed',
                                                  'refunded','partially_refunded','credited')),
  payment_id      uuid REFERENCES payments(id),
  reference       text,
  occurred_at     timestamptz NOT NULL DEFAULT now(),
  meta            jsonb NOT NULL DEFAULT '{}'::jsonb,
  CHECK (amount_paise IS NOT NULL OR display_amount IS NOT NULL)
);

CREATE INDEX transactions_user_idx ON transactions (user_id, occurred_at DESC);

-- Down Migration
DROP TABLE IF EXISTS transactions;
DROP TABLE IF EXISTS provider_events;
DROP TABLE IF EXISTS payments;
DROP TABLE IF EXISTS coupon_redemptions;
DROP TABLE IF EXISTS checkout_sessions;
DROP TABLE IF EXISTS coupons;
