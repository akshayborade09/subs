-- Up Migration

-- Money is always integer paise. Calendar facts are DATE. Instants are TIMESTAMPTZ.
-- `timestamp without time zone` must never appear in this schema.

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE users (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_country_code  text NOT NULL DEFAULT '+91',
  phone_number        text NOT NULL CHECK (phone_number ~ '^[6-9][0-9]{9}$'),
  phone_verified_at   timestamptz,
  full_name           text,
  date_of_birth       date,
  gender              text CHECK (gender IN ('woman','man','non_binary','prefer_not_to_say')),
  status              text NOT NULL DEFAULT 'active' CHECK (status IN ('active','blocked','deleted')),
  referral_code       text UNIQUE,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (phone_country_code, phone_number)
);

CREATE TRIGGER users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- OTP codes are stored only as hashes and never logged (handoff §5.2).
CREATE TABLE otp_challenges (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_country_code  text NOT NULL DEFAULT '+91',
  phone_number        text NOT NULL,
  code_hash           text NOT NULL,
  expires_at          timestamptz NOT NULL,
  attempts            smallint NOT NULL DEFAULT 0,
  max_attempts        smallint NOT NULL DEFAULT 5,
  consumed_at         timestamptz,
  device_id           text,
  created_at          timestamptz NOT NULL DEFAULT now()
);

-- Rate limiting and resend-cooldown lookups both scan by phone + recency.
CREATE INDEX otp_challenges_phone_created_idx
  ON otp_challenges (phone_country_code, phone_number, created_at DESC);

-- At most one live challenge per phone.
CREATE UNIQUE INDEX otp_challenges_one_active_idx
  ON otp_challenges (phone_country_code, phone_number)
  WHERE consumed_at IS NULL;

CREATE TABLE sessions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_token_hash  text NOT NULL UNIQUE,
  device_id           text,
  user_agent          text,
  expires_at          timestamptz NOT NULL,
  revoked_at          timestamptz,
  last_used_at        timestamptz NOT NULL DEFAULT now(),
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX sessions_user_idx ON sessions (user_id) WHERE revoked_at IS NULL;

-- Down Migration
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS otp_challenges;
DROP TABLE IF EXISTS users;
DROP FUNCTION IF EXISTS set_updated_at();
