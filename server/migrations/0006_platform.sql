-- Up Migration

-- Idempotency-Key support for every mutating route (handoff §19.2).
-- The transition to state='completed' with its stored response body MUST commit in
-- the same transaction as the effect it describes; otherwise a crash between the two
-- lets a retry re-execute the effect.
CREATE TABLE idempotency_keys (
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key             text NOT NULL,
  endpoint        text NOT NULL,
  request_hash    text NOT NULL,
  state           text NOT NULL DEFAULT 'in_progress' CHECK (state IN ('in_progress','completed')),
  response_status integer,
  response_body   jsonb,
  locked_at       timestamptz NOT NULL DEFAULT now(),
  completed_at    timestamptz,
  PRIMARY KEY (user_id, key)
);

CREATE INDEX idempotency_keys_stale_idx
  ON idempotency_keys (locked_at) WHERE state = 'in_progress';

-- Transactional outbox. Writers only ever INSERT here, inside the business
-- transaction. No HTTP call, no queue publish and no notification send ever happens
-- inside a transaction — the drain worker does that afterwards.
CREATE TABLE outbox_events (
  id              bigserial PRIMARY KEY,
  event_name      text NOT NULL,
  aggregate_type  text NOT NULL,
  aggregate_id    uuid NOT NULL,
  user_id         uuid REFERENCES users(id) ON DELETE CASCADE,
  payload         jsonb NOT NULL,
  occurred_at     timestamptz NOT NULL DEFAULT now(),
  available_at    timestamptz NOT NULL DEFAULT now(),
  attempts        integer NOT NULL DEFAULT 0,
  last_error      text,
  published_at    timestamptz
);

-- The drain worker's only query: FOR UPDATE SKIP LOCKED over this partial index.
CREATE INDEX outbox_events_pending_idx
  ON outbox_events (available_at, id) WHERE published_at IS NULL;
CREATE INDEX outbox_events_aggregate_idx ON outbox_events (aggregate_type, aggregate_id);

-- Makes at-least-once delivery safe: each subscriber processes each event once.
CREATE TABLE outbox_deliveries (
  subscriber    text NOT NULL,
  event_id      bigint NOT NULL REFERENCES outbox_events(id) ON DELETE CASCADE,
  delivered_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (subscriber, event_id)
);

CREATE TABLE audit_logs (
  id          bigserial PRIMARY KEY,
  user_id     uuid REFERENCES users(id) ON DELETE SET NULL,
  actor_type  text NOT NULL DEFAULT 'user' CHECK (actor_type IN ('user','system','ops','provider')),
  actor_id    text,
  action      text NOT NULL,
  entity_type text NOT NULL,
  entity_id   uuid,
  before      jsonb,
  after       jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX audit_logs_entity_idx ON audit_logs (entity_type, entity_id, created_at DESC);
CREATE INDEX audit_logs_user_idx ON audit_logs (user_id, created_at DESC);

-- Down Migration
DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS outbox_deliveries;
DROP TABLE IF EXISTS outbox_events;
DROP TABLE IF EXISTS idempotency_keys;
