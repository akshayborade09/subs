#!/usr/bin/env bash
# Trial -> subscription conversion, through to an active subscriber Home with a
# materialized week. Assumes the API is running (pnpm dev).
set -euo pipefail

BASE="${BASE:-http://127.0.0.1:4000/v1}"
PSQL=(psql -U tiffins -d tiffins -tAc)
jqr() { node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{const j=JSON.parse(s);console.log(process.argv[1].split('.').reduce((a,k)=>a?.[k],j)??'')}catch{console.log('')}})" "$1"; }
step() { printf '\n\033[1;36m▸ %s\033[0m\n' "$1"; }

PHONE="9$(printf '%09d' $(( $(date +%s) % 1000000000 )))"

step "Sign in as +91 $PHONE"
CODE=$(curl -sS -X POST "$BASE/auth/otp/start" -H 'content-type: application/json' -d "{\"phone\":\"$PHONE\"}" | jqr devCode)
T=$(curl -sS -X POST "$BASE/auth/otp/verify" -H 'content-type: application/json' -d "{\"phone\":\"$PHONE\",\"code\":\"$CODE\"}" | jqr accessToken)
AUTH=(-H "authorization: Bearer $T" -H 'content-type: application/json')

step "Address"
ADDR=$(curl -sS -X POST "${AUTH[@]}" "$BASE/me/addresses" -d '{"label":"home","line1":"B-704, Green View","city":"Pune","state":"Maharashtra","pincode":"411045"}' | jqr id)

step "Complete and pay for a trial (so the trial credit applies)"
curl -sS -o /dev/null -X POST "${AUTH[@]}" "$BASE/me/trial/draft"
curl -sS -o /dev/null -X PATCH "${AUTH[@]}" "$BASE/me/trial/preferences" -d '{"foodPreference":"vegetarian","mealPreference":"both","breadPreference":"bhakri","ricePreference":"jeera_rice"}'
DATES=$(node -e 'const d=new Date();const o=[];while(o.length<5){d.setDate(d.getDate()+1);const w=d.getDay();if(w&&w!==6)o.push(d.toISOString().slice(0,10))}console.log(JSON.stringify(o))')
curl -sS -o /dev/null -X PATCH "${AUTH[@]}" "$BASE/me/trial/dates" -d "{\"dates\":$DATES}"
curl -sS -o /dev/null -X PATCH "${AUTH[@]}" "$BASE/me/trial/address" -d "{\"addressId\":\"$ADDR\"}"
TC=$(curl -sS -X POST "${AUTH[@]}" "$BASE/me/trial/checkout" -H "idempotency-key: $(uuidgen)" -d '{"paymentMethod":"upi"}' | jqr checkoutSessionId)
curl -sS -o /dev/null -X POST "${AUTH[@]}" "$BASE/me/checkout/$TC/pay" -H "idempotency-key: $(uuidgen)" -d '{"scenario":"success_immediate"}'
sleep 2
echo "  lifecycle after trial payment: $(curl -sS "${AUTH[@]}" "$BASE/me/app-state" | jqr lifecycleState)"

step "Plans"
curl -sS "$BASE/subscription-plans" | head -c 300; echo

step "Quote the monthly plan — expect a ₹100 trial credit"
curl -sS -X POST "${AUTH[@]}" "$BASE/me/subscriptions/quote" -d '{"planCode":"monthly"}'; echo

step "Subscription checkout"
SC=$(curl -sS -X POST "${AUTH[@]}" "$BASE/me/subscriptions/checkout" -H "idempotency-key: $(uuidgen)" -d '{
  "planCode":"monthly","mealPreference":"both","foodPreference":"vegetarian",
  "breadPreference":"bhakri","ricePreference":"jeera_rice","selectedWeekdays":[1,2,3,4,5]}')
echo "$SC"
CHECKOUT=$(echo "$SC" | jqr checkoutSessionId)

step "Pay for the subscription"
curl -sS -o /dev/null -X POST "${AUTH[@]}" "$BASE/me/checkout/$CHECKOUT/pay" -H "idempotency-key: $(uuidgen)" -d '{"scenario":"success_immediate"}'
sleep 3
curl -sS "${AUTH[@]}" "$BASE/me/checkout/$CHECKOUT/payment-status"; echo

step "Current subscription"
curl -sS "${AUTH[@]}" "$BASE/me/subscriptions/current"; echo

step "Lifecycle — trial is still running, so Trial Home must win (spec §4.6)"
curl -sS "${AUTH[@]}" "$BASE/me/app-state" | jqr lifecycleState

step "Materialized subscription meal orders"
"${PSQL[@]}" "select count(*) from meal_orders mo join subscriptions s on s.id=mo.source_id where mo.source_type='subscription' and s.user_id=(select id from users where phone_number='$PHONE')"

step "Reconciler is idempotent (second run must create 0)"
(cd "$(dirname "$0")/.." && pnpm -s jobs:run 2>&1 | grep -E '^pass')

printf '\n\033[1;32m✓ subscription walkthrough complete\033[0m\n'
