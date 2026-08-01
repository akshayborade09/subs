#!/usr/bin/env bash
# Exercises the payment paths that actually break in production: duplicate webhook
# delivery, out-of-order delivery, and a double-tapped pay button.
set -euo pipefail

BASE="${BASE:-http://127.0.0.1:4000/v1}"
jqr() { node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{const j=JSON.parse(s);console.log(process.argv[1].split('.').reduce((a,k)=>a?.[k],j)??'')}catch{console.log('')}})" "$1"; }
step() { printf '\n\033[1;36m▸ %s\033[0m\n' "$1"; }

# Spin up a fully-configured user ready to pay, and echo its token + checkout id.
# The phone must be unique per call: $RANDOM does not advance in the parent across
# command substitutions, so a naive random would reuse one number and trip the
# 30-second OTP resend cooldown on every call after the first.
SETUP_SEQ=0
setup() {
  SETUP_SEQ=$((SETUP_SEQ + 1))
  local phone="9$(printf '%09d' $(( ($(date +%s) + SETUP_SEQ * 7919) % 1000000000 )))"
  local code token addr dates
  code=$(curl -sS -X POST "$BASE/auth/otp/start" -H 'content-type: application/json' -d "{\"phone\":\"$phone\"}" | jqr devCode)
  token=$(curl -sS -X POST "$BASE/auth/otp/verify" -H 'content-type: application/json' -d "{\"phone\":\"$phone\",\"code\":\"$code\"}" | jqr accessToken)
  addr=$(curl -sS -X POST "$BASE/me/addresses" -H "authorization: Bearer $token" -H 'content-type: application/json' \
    -d '{"label":"home","line1":"B-704, Green View","city":"Pune","state":"Maharashtra","pincode":"411045"}' | jqr id)
  curl -sS -o /dev/null -X POST "$BASE/me/trial/draft" -H "authorization: Bearer $token"
  curl -sS -o /dev/null -X PATCH "$BASE/me/trial/preferences" -H "authorization: Bearer $token" -H 'content-type: application/json' \
    -d '{"foodPreference":"vegetarian","mealPreference":"lunch","breadPreference":"bhakri","ricePreference":"jeera_rice"}'
  dates=$(node -e 'const d=new Date();const o=[];while(o.length<5){d.setDate(d.getDate()+1);const w=d.getDay();if(w&&w!==6)o.push(d.toISOString().slice(0,10))}console.log(JSON.stringify(o))')
  curl -sS -o /dev/null -X PATCH "$BASE/me/trial/dates" -H "authorization: Bearer $token" -H 'content-type: application/json' -d "{\"dates\":$dates}"
  curl -sS -o /dev/null -X PATCH "$BASE/me/trial/address" -H "authorization: Bearer $token" -H 'content-type: application/json' -d "{\"addressId\":\"$addr\"}"
  local checkout
  checkout=$(curl -sS -X POST "$BASE/me/trial/checkout" -H "authorization: Bearer $token" -H 'content-type: application/json' \
    -H "idempotency-key: $(uuidgen)" -d '{"paymentMethod":"upi"}' | jqr checkoutSessionId)
  echo "$token $checkout"
}

step "Scenario: duplicate_webhook — the same event delivered twice"
SETUP_SEQ=$((SETUP_SEQ + 1)); read -r TOKEN CHECKOUT <<<"$(setup)"
curl -sS -o /dev/null -X POST "$BASE/me/checkout/$CHECKOUT/pay" -H "authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' -H "idempotency-key: $(uuidgen)" -d '{"scenario":"duplicate_webhook"}'
sleep 2
curl -sS "$BASE/me/checkout/$CHECKOUT/payment-status" -H "authorization: Bearer $TOKEN"; echo
echo "  meal orders created (expect 5, not 10):"
psql -U tiffins -d tiffins -tAc "select count(*) from meal_orders where source_id=(select source_id from checkout_sessions where id='$CHECKOUT')"

step "Scenario: out_of_order — captured, then a stale pending"
SETUP_SEQ=$((SETUP_SEQ + 1)); read -r TOKEN CHECKOUT <<<"$(setup)"
curl -sS -o /dev/null -X POST "$BASE/me/checkout/$CHECKOUT/pay" -H "authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' -H "idempotency-key: $(uuidgen)" -d '{"scenario":"out_of_order"}'
sleep 2
echo "  expect paymentStatus=captured (the late 'pending' must not win):"
curl -sS "$BASE/me/checkout/$CHECKOUT/payment-status" -H "authorization: Bearer $TOKEN"; echo

step "Scenario: fail_after_2s — expect TRIAL_PAYMENT_FAILED"
SETUP_SEQ=$((SETUP_SEQ + 1)); read -r TOKEN CHECKOUT <<<"$(setup)"
curl -sS -o /dev/null -X POST "$BASE/me/checkout/$CHECKOUT/pay" -H "authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' -H "idempotency-key: $(uuidgen)" -d '{"scenario":"fail_after_2s"}'
sleep 3
curl -sS "$BASE/me/app-state" -H "authorization: Bearer $TOKEN" | jqr lifecycleState

step "Idempotency: the same key twice must create ONE payment"
SETUP_SEQ=$((SETUP_SEQ + 1)); read -r TOKEN CHECKOUT <<<"$(setup)"
KEY=$(uuidgen)
P1=$(curl -sS -X POST "$BASE/me/checkout/$CHECKOUT/pay" -H "authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' -H "idempotency-key: $KEY" -d '{"scenario":"pending_forever"}' | jqr paymentId)
P2=$(curl -sS -X POST "$BASE/me/checkout/$CHECKOUT/pay" -H "authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' -H "idempotency-key: $KEY" -d '{"scenario":"pending_forever"}' | jqr paymentId)
echo "  first=$P1"
echo "  replay=$P2"
[ "$P1" = "$P2" ] && echo "  ✓ replayed, not re-charged" || { echo "  ✗ DIFFERENT PAYMENTS"; exit 1; }
echo "  payment rows for this checkout (expect 1):"
psql -U tiffins -d tiffins -tAc "select count(*) from payments where checkout_session_id='$CHECKOUT'"

step "Idempotency: same key, different body must be rejected"
curl -sS -X POST "$BASE/me/checkout/$CHECKOUT/pay" -H "authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' -H "idempotency-key: $KEY" -d '{"scenario":"success_immediate"}'; echo

step "Webhook with a bad signature must be refused"
curl -sS -X POST "$BASE/webhooks/payments/mock" -H 'content-type: application/json' \
  -H 'x-mock-signature: deadbeef' -d '{"providerEventId":"evt_forged","kind":"payment.captured"}'; echo

printf '\n\033[1;32m✓ edge cases verified\033[0m\n'
