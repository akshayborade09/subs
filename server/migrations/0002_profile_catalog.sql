-- Up Migration

CREATE TABLE serviceable_pincodes (
  pincode     text PRIMARY KEY CHECK (pincode ~ '^[1-9][0-9]{5}$'),
  city        text NOT NULL,
  state       text NOT NULL,
  zone        text,
  is_active   boolean NOT NULL DEFAULT true
);

CREATE TABLE addresses (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label                 text NOT NULL DEFAULT 'home' CHECK (label IN ('home','office','other')),
  building_type         text CHECK (building_type IN ('apartment','house','office','other')),
  flat_or_house         text,
  building_or_society   text,
  line1                 text NOT NULL,
  line2                 text,
  landmark              text,
  delivery_instructions text,
  city                  text NOT NULL,
  state                 text NOT NULL,
  pincode               text NOT NULL,
  latitude              numeric(9,6),
  longitude             numeric(9,6),
  is_default            boolean NOT NULL DEFAULT false,
  is_serviceable        boolean NOT NULL DEFAULT false,
  deleted_at            timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER addresses_updated_at BEFORE UPDATE ON addresses
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Spec §8.2: at least one default exists whenever any address is saved.
CREATE UNIQUE INDEX addresses_one_default_idx
  ON addresses (user_id) WHERE is_default AND deleted_at IS NULL;
CREATE INDEX addresses_user_idx ON addresses (user_id) WHERE deleted_at IS NULL;

CREATE TABLE user_preferences (
  user_id           uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  food_preference   text NOT NULL CHECK (food_preference IN ('vegetarian','non_vegetarian','mix')),
  meal_preference   text NOT NULL CHECK (meal_preference IN ('lunch','dinner','both')),
  bread_preference  text NOT NULL CHECK (bread_preference IN ('chapati','bhakri','paratha','any')),
  rice_preference   text NOT NULL CHECK (rice_preference IN ('plain_rice','jeera_rice','brown_rice','any')),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER user_preferences_updated_at BEFORE UPDATE ON user_preferences
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Mirrors the 14-step wizard in src/TrialFlow.tsx so an interrupted user resumes
-- at the exact step rather than restarting (lifecycle spec §3.2).
CREATE TABLE onboarding_drafts (
  user_id             uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  status              text NOT NULL DEFAULT 'in_progress'
                        CHECK (status IN ('in_progress','complete','abandoned')),
  last_completed_step text CHECK (last_completed_step IN (
                        'personal','intro','food','meal','mixMeals','bread','rice',
                        'locate','address','confirm','summary','payment','success','tracker')),
  resume_step         text NOT NULL DEFAULT 'personal',
  payload             jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER onboarding_drafts_updated_at BEFORE UPDATE ON onboarding_drafts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE subscription_plans (
  id                              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code                            text NOT NULL UNIQUE CHECK (code IN ('weekly','monthly','quarterly')),
  name                            text NOT NULL,
  duration_days                   integer NOT NULL CHECK (duration_days > 0),
  meal_count                      integer NOT NULL CHECK (meal_count > 0),
  price_paise                     integer NOT NULL CHECK (price_paise >= 0),
  discount_paise                  integer NOT NULL DEFAULT 0 CHECK (discount_paise >= 0),
  effective_price_per_meal_paise  integer NOT NULL CHECK (effective_price_per_meal_paise >= 0),
  badge                           text CHECK (badge IN ('recommended','best_value')),
  is_active                       boolean NOT NULL DEFAULT true,
  sort_order                      smallint NOT NULL DEFAULT 0
);

CREATE TABLE menu_items (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  serving       text NOT NULL,
  food_type     text NOT NULL CHECK (food_type IN ('vegetarian','non_vegetarian')),
  category      text CHECK (category IN ('bread','rice','main','side','accompaniment','dessert')),
  calories_kcal integer NOT NULL DEFAULT 0,
  protein_g     numeric(6,2) NOT NULL DEFAULT 0,
  carbs_g       numeric(6,2) NOT NULL DEFAULT 0,
  fat_g         numeric(6,2) NOT NULL DEFAULT 0,
  fibre_g       numeric(6,2) NOT NULL DEFAULT 0,
  sodium_mg     integer NOT NULL DEFAULT 0,
  is_active     boolean NOT NULL DEFAULT true
);

CREATE TABLE daily_menus (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_date  date NOT NULL,
  slot          text NOT NULL CHECK (slot IN ('lunch','dinner')),
  food_type     text NOT NULL CHECK (food_type IN ('vegetarian','non_vegetarian')),
  item_ids      uuid[] NOT NULL DEFAULT '{}',
  UNIQUE (service_date, slot, food_type)
);

-- Down Migration
DROP TABLE IF EXISTS daily_menus;
DROP TABLE IF EXISTS menu_items;
DROP TABLE IF EXISTS subscription_plans;
DROP TABLE IF EXISTS onboarding_drafts;
DROP TABLE IF EXISTS user_preferences;
DROP TABLE IF EXISTS addresses;
DROP TABLE IF EXISTS serviceable_pincodes;
