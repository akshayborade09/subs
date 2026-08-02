#!/usr/bin/env bash
# Full Phase 1-5 regression. Safe to run repeatedly.
#
#   ./scripts/regression.sh            # db + unit + integration + typechecks
#   LIVE=1 ./scripts/regression.sh     # also drive the shell walkthroughs (needs pnpm dev)
set -uo pipefail

export PATH="/opt/homebrew/opt/postgresql@17/bin:$PATH"
TEST_DB="${TEST_DB:-postgres://tiffins:tiffins@localhost:5432/tiffins_test}"
BASE="${BASE:-http://127.0.0.1:4000/v1}"

PASS=0; FAIL=0
ok()   { printf '  \033[32m✓\033[0m %s\n' "$1"; PASS=$((PASS+1)); }
bad()  { printf '  \033[31m✗ %s\033[0m — %s\n' "$1" "${2:-}"; FAIL=$((FAIL+1)); }
head_() { printf '\n\033[1;36m── %s\033[0m\n' "$1"; }
check() { # name, actual, expected
  [ "$2" = "$3" ] && ok "$1" || bad "$1" "expected '$3', got '$2'"
}

head_ "Migrations rebuild from an empty database"
psql -U tiffins -d tiffins_test -q -c "drop schema public cascade; create schema public;" >/dev/null 2>&1
DATABASE_URL="$TEST_DB" pnpm exec node-pg-migrate --envPath /dev/null up >/dev/null 2>&1
TABLES=$(psql -U tiffins -d tiffins_test -tAc "select count(*) from information_schema.tables where table_schema='public'")
[ "$TABLES" -ge 33 ] && ok "schema built ($TABLES tables)" || bad "schema build" "only $TABLES tables"

# Named rather than counted: a bare number goes stale on every migration and says
# nothing about WHICH table vanished.
MISSING=$(psql -U tiffins -d tiffins_test -tAc "
  select string_agg(t, ', ') from unnest(ARRAY[
    'users','sessions','addresses','trials','subscriptions','meal_orders',
    'checkout_sessions','payments','provider_events','transactions','coupons',
    'rewards','loyalty_periods','referrals','leaderboard_points','support_issues',
    'outbox_events','idempotency_keys','audit_logs'
  ]) t where to_regclass('public.'||t) is null")
check "no core table missing" "${MISSING:-none}" "none"

NAIVE=$(psql -U tiffins -d tiffins_test -tAc "select count(*) from information_schema.columns where table_schema='public' and data_type='timestamp without time zone' and table_name<>'pgmigrations'")
check "no naive timestamps" "$NAIVE" "0"

MONEY=$(psql -U tiffins -d tiffins_test -tAc "select count(*) from information_schema.columns where table_schema='public' and column_name like '%paise%' and data_type<>'integer'")
check "all paise columns are integer" "$MONEY" "0"

head_ "Seed is idempotent"
DATABASE_URL="$TEST_DB" pnpm -s seed >/dev/null 2>&1
DATABASE_URL="$TEST_DB" pnpm -s seed >/dev/null 2>&1
PLANS=$(psql -U tiffins -d tiffins_test -tAc "select count(*) from subscription_plans")
PINS=$(psql -U tiffins -d tiffins_test -tAc "select count(*) from serviceable_pincodes")
ITEMS=$(psql -U tiffins -d tiffins_test -tAc "select count(*) from menu_items")
check "3 plans after two seeds" "$PLANS" "3"
check "8 pincodes after two seeds" "$PINS" "8"
check "6 menu items after two seeds" "$ITEMS" "6"

head_ "Typechecks"
pnpm exec tsc --noEmit >/dev/null 2>&1 && ok "server typecheck" || bad "server typecheck" "tsc reported errors"
(cd .. && pnpm -s typecheck >/dev/null 2>&1) && ok "expo app typecheck" || bad "expo app typecheck" "tsc reported errors"

head_ "Unit tests"
UNIT=$(pnpm -s test 2>&1 | grep -oE 'Tests +[0-9]+ passed \([0-9]+\)' | grep -oE '[0-9]+ passed' | head -1)
[ -n "$UNIT" ] && ok "unit: $UNIT" || bad "unit tests" "no passing summary found"
pnpm -s test 2>&1 | grep -q "failed" && bad "unit tests" "some failed" || ok "no unit failures"

head_ "Integration tests"
INT=$(DATABASE_URL="$TEST_DB" pnpm -s test:integration 2>&1 | grep -oE 'Tests +[0-9]+ passed \([0-9]+\)' | grep -oE '[0-9]+ passed' | head -1)
[ -n "$INT" ] && ok "integration: $INT" || bad "integration tests" "no passing summary found"

head_ "Destructive-reset guard"
GUARD=$(DATABASE_URL="postgres://tiffins:tiffins@localhost:5432/tiffins" pnpm -s test:integration 2>&1 | grep -c 'Refusing to TRUNCATE')
[ "$GUARD" -gt 0 ] && ok "refuses a non-test database" || bad "reset guard" "did not refuse the dev database"

head_ "Reconcilers are idempotent"
RECON=$(DATABASE_URL="$TEST_DB" pnpm -s jobs:run 2>&1 | grep -c '^pass')
check "both passes completed" "$RECON" "2"
SECOND=$(DATABASE_URL="$TEST_DB" pnpm -s jobs:run 2>&1 | grep '^pass 2' | grep -oE '"mealOrdersCreated":[0-9]+' | grep -oE '[0-9]+')
check "second pass creates nothing" "$SECOND" "0"

if [ "${LIVE:-0}" = "1" ]; then
  head_ "Live API"
  CODE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "$BASE/health")
  check "health" "$CODE" "200"

  ERRS=$(./scripts/walkthrough.sh 2>&1 | grep -cE '"error"')
  check "trial walkthrough has no errors" "$ERRS" "0"

  CONFLICTS=$(./scripts/verify-meal-changes.sh 2>&1 | grep -cE 'SCHEDULE_CONFLICT')
  [ "$CONFLICTS" -ge 1 ] && ok "409 schedule conflict fires" || bad "409 conflict" "never fired"

  STATES=0
  for s in A B C D E F G H I J K L M N O P Q R Y AA; do
    curl -s --max-time 5 "$BASE/me/app-state?simulateState=$s" | grep -q lifecycleState && STATES=$((STATES+1))
  done
  check "all 20 states resolve" "$STATES" "20"

  LEAK=$(psql -U tiffins -d postgres -tAc "select count(*) from pg_stat_activity where datname='tiffins' and state='idle in transaction'")
  check "no leaked transactions" "$LEAK" "0"
fi

printf '\n\033[1m%s passed, %s failed\033[0m\n' "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ] || exit 1
