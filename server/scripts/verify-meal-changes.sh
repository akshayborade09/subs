#!/usr/bin/env bash
# Meal detail, cutoffs, date/address moves and the optimistic-concurrency 409.
set -euo pipefail

BASE="${BASE:-http://127.0.0.1:4000/v1}"
jqr() { node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{const j=JSON.parse(s);console.log(process.argv[1].split('.').reduce((a,k)=>a?.[k],j)??'')}catch{console.log('')}})" "$1"; }
step() { printf '\n\033[1;36m▸ %s\033[0m\n' "$1"; }

PHONE="9$(printf '%09d' $(( $(date +%s) % 1000000000 )))"
CODE=$(curl -sS -X POST "$BASE/auth/otp/start" -H 'content-type: application/json' -d "{\"phone\":\"$PHONE\"}" | jqr devCode)
T=$(curl -sS -X POST "$BASE/auth/otp/verify" -H 'content-type: application/json' -d "{\"phone\":\"$PHONE\",\"code\":\"$CODE\"}" | jqr accessToken)
AUTH=(-H "authorization: Bearer $T" -H 'content-type: application/json')

ADDR=$(curl -sS -X POST "${AUTH[@]}" "$BASE/me/addresses" -d '{"label":"home","line1":"B-704, Green View","city":"Pune","state":"Maharashtra","pincode":"411045"}' | jqr id)
ADDR2=$(curl -sS -X POST "${AUTH[@]}" "$BASE/me/addresses" -d '{"label":"office","line1":"Tech Park, Hinjawadi","city":"Pune","state":"Maharashtra","pincode":"411057"}' | jqr id)
BADADDR=$(curl -sS -X POST "${AUTH[@]}" "$BASE/me/addresses" -d '{"label":"other","line1":"MG Road","city":"Bengaluru","state":"Karnataka","pincode":"560001"}' | jqr id)

curl -sS -o /dev/null -X POST "${AUTH[@]}" "$BASE/me/trial/draft"
curl -sS -o /dev/null -X PATCH "${AUTH[@]}" "$BASE/me/trial/preferences" -d '{"foodPreference":"vegetarian","mealPreference":"lunch","breadPreference":"bhakri","ricePreference":"jeera_rice"}'
# Start three days out so the first meal is comfortably inside its edit window.
DATES=$(node -e 'const d=new Date();d.setDate(d.getDate()+2);const o=[];while(o.length<5){d.setDate(d.getDate()+1);const w=d.getDay();if(w&&w!==6)o.push(d.toISOString().slice(0,10))}console.log(JSON.stringify(o))')
curl -sS -o /dev/null -X PATCH "${AUTH[@]}" "$BASE/me/trial/dates" -d "{\"dates\":$DATES}"
curl -sS -o /dev/null -X PATCH "${AUTH[@]}" "$BASE/me/trial/address" -d "{\"addressId\":\"$ADDR\"}"
C=$(curl -sS -X POST "${AUTH[@]}" "$BASE/me/trial/checkout" -H "idempotency-key: $(uuidgen)" -d '{"paymentMethod":"upi"}' | jqr checkoutSessionId)
curl -sS -o /dev/null -X POST "${AUTH[@]}" "$BASE/me/checkout/$C/pay" -H "idempotency-key: $(uuidgen)" -d '{"scenario":"success_immediate"}'
sleep 2

MEAL=$(curl -sS "${AUTH[@]}" "$BASE/me/app-state" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const j=JSON.parse(s);console.log(j.home.week.flatMap(d=>d.markers)[0].mealOrderId)})")

step "Meal detail — editable, with its cutoff"
curl -sS "${AUTH[@]}" "$BASE/me/meals/$MEAL"; echo
VER=$(curl -sS "${AUTH[@]}" "$BASE/me/meals/$MEAL" | jqr scheduleVersion)

step "Selectable dates (excludes dates already holding this slot)"
curl -sS "${AUTH[@]}" "$BASE/me/meals/$MEAL/selectable-dates" | head -c 200; echo

step "Move the meal — status and identity travel with it"
# Must not collide with the trial's own dates, or we test the collision guard
# instead of the move.
NEW=$(node -e 'const taken=new Set(JSON.parse(process.argv[1]));const d=new Date();d.setDate(d.getDate()+15);for(;;){const w=d.getDay();const iso=d.toISOString().slice(0,10);if(w&&w!==6&&!taken.has(iso)){console.log(iso);break}d.setDate(d.getDate()+1)}' "$DATES")
echo "  moving to $NEW" 
curl -sS -X PATCH "${AUTH[@]}" "$BASE/me/meals/$MEAL/date" -d "{\"newDate\":\"$NEW\",\"expectedScheduleVersion\":$VER}"; echo

step "Stale version must be refused with 409 + a fresh Home"
NEW2=$(node -e 'const taken=new Set(JSON.parse(process.argv[1]));taken.add(process.argv[2]);const d=new Date();d.setDate(d.getDate()+18);for(;;){const w=d.getDay();const iso=d.toISOString().slice(0,10);if(w&&w!==6&&!taken.has(iso)){console.log(iso);break}d.setDate(d.getDate()+1)}' "$DATES" "$NEW")
curl -sS -X PATCH "${AUTH[@]}" "$BASE/me/meals/$MEAL/date" -d "{\"newDate\":\"$NEW2\",\"expectedScheduleVersion\":$VER}" | head -c 260; echo

step "Move to an unserviceable address must leave the meal untouched"
curl -sS -X PATCH "${AUTH[@]}" "$BASE/me/meals/$MEAL/address" -d "{\"addressId\":\"$BADADDR\"}"; echo

step "Move to a serviceable address"
curl -sS -X PATCH "${AUTH[@]}" "$BASE/me/meals/$MEAL/address" -d "{\"addressId\":\"$ADDR2\"}"; echo

step "Per-meal preference change"
curl -sS -X PATCH "${AUTH[@]}" "$BASE/me/meals/$MEAL/preferences" -d '{"breadPreference":"chapati"}'; echo

step "Collision: move onto a date that already holds this slot"
OCCUPIED=$(node -e "console.log(JSON.parse(process.argv[1])[1])" "$DATES")
curl -sS -X PATCH "${AUTH[@]}" "$BASE/me/meals/$MEAL/date" -d "{\"newDate\":\"$OCCUPIED\"}"; echo

step "Past-dated move must be refused"
curl -sS -X PATCH "${AUTH[@]}" "$BASE/me/meals/$MEAL/date" -d '{"newDate":"2020-01-01"}'; echo

step "Home reflects the move, re-sorted chronologically"
curl -sS "${AUTH[@]}" "$BASE/me/app-state" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const j=JSON.parse(s);console.log('  dates:', j.home.week.map(d=>d.date).join(' '));console.log('  sorted:', JSON.stringify(j.home.week.map(d=>d.date))===JSON.stringify([...j.home.week.map(d=>d.date)].sort()))})"

printf '\n\033[1;32m✓ meal change checks complete\033[0m\n'
