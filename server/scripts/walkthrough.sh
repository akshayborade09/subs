#!/usr/bin/env bash
# End-to-end walkthrough of the trial journey against a running server.
#   pnpm dev              # in one terminal
#   ./scripts/walkthrough.sh
set -euo pipefail

BASE="${BASE:-http://127.0.0.1:4000/v1}"
PHONE="${PHONE:-98$(printf '%08d' $((RANDOM * RANDOM % 100000000)))}"

jqr() { node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{const j=JSON.parse(s);const v=process.argv[1].split('.').reduce((a,k)=>a?.[k],j);console.log(v??'')}catch{console.log('')}})" "$1"; }
step() { printf '\n\033[1;36m▸ %s\033[0m\n' "$1"; }

step "Health"
curl -sS "$BASE/health"; echo

step "Start OTP for +91 $PHONE"
OTP_RESP=$(curl -sS -X POST "$BASE/auth/otp/start" -H 'content-type: application/json' -d "{\"phone\":\"$PHONE\"}")
echo "$OTP_RESP"
CODE=$(echo "$OTP_RESP" | jqr devCode)

step "Verify OTP ($CODE)"
SESSION=$(curl -sS -X POST "$BASE/auth/otp/verify" -H 'content-type: application/json' \
  -d "{\"phone\":\"$PHONE\",\"code\":\"$CODE\"}")
TOKEN=$(echo "$SESSION" | jqr accessToken)
echo "userId=$(echo "$SESSION" | jqr userId) isNewUser=$(echo "$SESSION" | jqr isNewUser)"
AUTH=(-H "authorization: Bearer $TOKEN" -H 'content-type: application/json')

step "App state — expect ONBOARDING_INCOMPLETE"
curl -sS "${AUTH[@]}" "$BASE/me/app-state"; echo

step "Profile"
curl -sS -X PATCH "${AUTH[@]}" "$BASE/me/profile" \
  -d '{"fullName":"Akshay Borade","dateOfBirth":"1992-07-18","gender":"man"}'; echo

step "Serviceability — 411045 (yes) then 560001 (no)"
curl -sS -X POST "${AUTH[@]}" "$BASE/serviceability/check" -d '{"pincode":"411045"}'; echo
curl -sS -X POST "${AUTH[@]}" "$BASE/serviceability/check" -d '{"pincode":"560001"}'; echo

step "Add address"
ADDRESS=$(curl -sS -X POST "${AUTH[@]}" "$BASE/me/addresses" -d '{
  "label":"home","buildingType":"apartment","flatOrHouse":"B-704",
  "buildingOrSociety":"Green View Apartments",
  "line1":"B-704, Green View Apartments, Baner Road","city":"Pune",
  "state":"Maharashtra","pincode":"411045"}')
echo "$ADDRESS"
ADDRESS_ID=$(echo "$ADDRESS" | jqr id)

step "Trial draft"
curl -sS -X POST "${AUTH[@]}" "$BASE/me/trial/draft"; echo

step "Trial preferences"
curl -sS -X PATCH "${AUTH[@]}" "$BASE/me/trial/preferences" -d '{
  "foodPreference":"vegetarian","mealPreference":"both",
  "breadPreference":"bhakri","ricePreference":"jeera_rice"}'; echo

step "Trial dates (next five weekdays)"
DATES=$(node -e '
const d=new Date();const out=[];
while(out.length<5){d.setDate(d.getDate()+1);const w=d.getDay();if(w!==0&&w!==6)out.push(d.toISOString().slice(0,10));}
console.log(JSON.stringify(out));')
echo "  $DATES"
curl -sS -X PATCH "${AUTH[@]}" "$BASE/me/trial/dates" -d "{\"dates\":$DATES}"; echo

step "Trial address"
curl -sS -X PATCH "${AUTH[@]}" "$BASE/me/trial/address" -d "{\"addressId\":\"$ADDRESS_ID\"}"; echo

step "Trial review — expect ready=true"
curl -sS "${AUTH[@]}" "$BASE/me/trial/review"; echo

step "Checkout"
CHECKOUT=$(curl -sS -X POST "${AUTH[@]}" "$BASE/me/trial/checkout" \
  -H "idempotency-key: $(uuidgen)" -d '{"paymentMethod":"upi"}')
echo "$CHECKOUT"
CHECKOUT_ID=$(echo "$CHECKOUT" | jqr checkoutSessionId)

step "Pay (mock, pending → success)"
curl -sS -X POST "${AUTH[@]}" "$BASE/me/checkout/$CHECKOUT_ID/pay" \
  -H "idempotency-key: $(uuidgen)" -d '{"scenario":"pending_then_success"}'; echo

step "App state while pending — expect TRIAL_PAYMENT_PENDING"
curl -sS "${AUTH[@]}" "$BASE/me/app-state"; echo

step "Waiting for the mock webhook…"
sleep 4

step "Payment status"
curl -sS "${AUTH[@]}" "$BASE/me/checkout/$CHECKOUT_ID/payment-status"; echo

step "App state after payment — expect TRIAL_SCHEDULED with a real week"
curl -sS "${AUTH[@]}" "$BASE/me/app-state"; echo

printf '\n\033[1;32m✓ walkthrough complete\033[0m\n'
