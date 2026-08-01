-- Up Migration

-- STORED vs DERIVED, the rule that keeps this schema honest:
--   store what an ACTOR decides, derive what the CLOCK decides.
-- So `status` below covers only actor-driven transitions (money, cancellation).
-- scheduled / active / completed / expired / paused are derived at read time from
-- these date columns, which means a late job can never produce a wrong Home screen.

CREATE TABLE trials (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status              text NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft','payment_pending','payment_failed','paid','cancelled')),
  service_dates       date[] NOT NULL DEFAULT '{}',
  first_service_date  date,
  last_service_date   date,
  address_id          uuid REFERENCES addresses(id),
  food_preference     text CHECK (food_preference IN ('vegetarian','non_vegetarian','mix')),
  meal_preference     text CHECK (meal_preference IN ('lunch','dinner','both')),
  bread_preference    text,
  rice_preference     text,
  -- Per-day veg/non-veg overrides collected when food_preference = 'mix'.
  daily_meals         jsonb NOT NULL DEFAULT '[]'::jsonb,
  price_paise         integer NOT NULL DEFAULT 0 CHECK (price_paise >= 0),
  paid_at             timestamptz,
  cancelled_at        timestamptz,
  -- Optimistic concurrency for every child meal_order (handoff §19.3).
  schedule_version    integer NOT NULL DEFAULT 0,
  -- Stamped by the daily sweep so trial.completed is emitted exactly once.
  completed_event_at  timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CHECK (first_service_date IS NULL OR last_service_date IS NULL
         OR first_service_date <= last_service_date)
);

CREATE TRIGGER trials_updated_at BEFORE UPDATE ON trials
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX trials_user_idx ON trials (user_id, created_at DESC);
-- A user may only ever have one trial that is not cancelled.
CREATE UNIQUE INDEX trials_one_live_per_user_idx
  ON trials (user_id) WHERE status <> 'cancelled';
-- Drives the emit-trial-completed sweep.
CREATE INDEX trials_completion_sweep_idx
  ON trials (last_service_date) WHERE status = 'paid' AND completed_event_at IS NULL;

CREATE TABLE subscriptions (
  id                            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id                       uuid NOT NULL REFERENCES subscription_plans(id),
  status                        text NOT NULL DEFAULT 'pending_payment'
                                  CHECK (status IN ('pending_payment','paid',
                                                    'cancelled_at_period_end','terminated')),
  meal_preference               text NOT NULL CHECK (meal_preference IN ('lunch','dinner','both')),
  food_preference               text NOT NULL CHECK (food_preference IN ('vegetarian','non_vegetarian','mix')),
  bread_preference              text NOT NULL,
  rice_preference               text NOT NULL,
  -- ISO weekdays, 1 = Monday … 7 = Sunday.
  selected_weekdays             smallint[] NOT NULL DEFAULT '{1,2,3,4,5}',
  address_id                    uuid NOT NULL REFERENCES addresses(id),
  starts_on                     date NOT NULL,
  ends_on                       date NOT NULL,
  -- Pause is a window, not a flag: gives future-dated pauses for free.
  pause_from                    date,
  pause_to                      date,
  cancelled_at                  timestamptz,
  renewal_failed_at             timestamptz,
  renewal_failure_resolved_at   timestamptz,
  auto_renew                    boolean NOT NULL DEFAULT true,
  paid_at                       timestamptz,
  schedule_version              integer NOT NULL DEFAULT 0,
  expired_event_at              timestamptz,
  created_at                    timestamptz NOT NULL DEFAULT now(),
  updated_at                    timestamptz NOT NULL DEFAULT now(),
  CHECK (starts_on <= ends_on),
  CHECK (pause_from IS NULL OR pause_to IS NULL OR pause_from <= pause_to)
);

CREATE TRIGGER subscriptions_updated_at BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX subscriptions_user_idx ON subscriptions (user_id, created_at DESC);
CREATE INDEX subscriptions_materialize_idx
  ON subscriptions (ends_on) WHERE status IN ('paid','cancelled_at_period_end');
CREATE INDEX subscriptions_renewal_idx
  ON subscriptions (ends_on) WHERE auto_renew AND status = 'paid';
-- Unresolved renewal failure is condition P.
CREATE INDEX subscriptions_renewal_failed_idx
  ON subscriptions (user_id) WHERE renewal_failed_at IS NOT NULL AND renewal_failure_resolved_at IS NULL;

-- ONE ROW PER (service_date, slot).
-- The app collapses a day into a positional mealMarkers[] array (index 0 = lunch,
-- 1 = dinner), but that shape cannot carry two distinct meal-detail payloads for one
-- date. Normalize here; collapse in the app-state projection.
CREATE TABLE meal_orders (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_type         text NOT NULL CHECK (source_type IN ('trial','subscription','reward')),
  source_id           uuid NOT NULL,
  service_date        date NOT NULL,
  slot                text NOT NULL CHECK (slot IN ('lunch','dinner')),
  food_type           text NOT NULL CHECK (food_type IN ('vegetarian','non_vegetarian')),
  bread_preference    text NOT NULL,
  rice_preference     text NOT NULL,
  address_id          uuid NOT NULL REFERENCES addresses(id),
  -- NULL until the physical world acts on it. 'scheduled' and 'upcoming' are NOT
  -- stored: they are derived from service_date and the delivery window, which
  -- removes an entire class of per-row status-flip jobs.
  ops_status          text CHECK (ops_status IN ('preparing','out_for_delivery','delivered',
                                                 'delayed','delivery_failed','cancelled','skipped')),
  ops_status_at       timestamptz,
  ops_note            text,
  -- Set when a user moves a meal; drives the "rescheduled" indicator.
  rescheduled_from    date,
  date_change_count   smallint NOT NULL DEFAULT 0,
  rating              smallint CHECK (rating BETWEEN 1 AND 5),
  feedback_tags       text[],
  feedback_note       text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  -- Makes materialization idempotent: the daily reconciler can re-run forever.
  UNIQUE (source_type, source_id, service_date, slot)
);

CREATE TRIGGER meal_orders_updated_at BEFORE UPDATE ON meal_orders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- The snapshot loader's hot path: one user's window around today.
CREATE INDEX meal_orders_user_date_idx ON meal_orders (user_id, service_date, slot);
-- Open delivery exceptions drive conditions Q and R.
CREATE INDEX meal_orders_exceptions_idx
  ON meal_orders (user_id, service_date)
  WHERE ops_status IN ('delayed','delivery_failed');
CREATE INDEX meal_orders_source_idx ON meal_orders (source_type, source_id);

CREATE TABLE meal_order_events (
  id              bigserial PRIMARY KEY,
  meal_order_id   uuid NOT NULL REFERENCES meal_orders(id) ON DELETE CASCADE,
  ops_status      text NOT NULL,
  occurred_at     timestamptz NOT NULL DEFAULT now(),
  actor           text NOT NULL DEFAULT 'system',
  note            text
);

CREATE INDEX meal_order_events_order_idx ON meal_order_events (meal_order_id, occurred_at DESC);

-- Down Migration
DROP TABLE IF EXISTS meal_order_events;
DROP TABLE IF EXISTS meal_orders;
DROP TABLE IF EXISTS subscriptions;
DROP TABLE IF EXISTS trials;
