# Regression Checklist

Use this checklist after any change to onboarding, address, meal detail, subscription, lifecycle, or tokens.  
Do **not** mark an item complete unless it was re-tested.

---

## Always run (static)

- [ ] `pnpm typecheck`
- [ ] `pnpm export` (or platform build used for release)
- [ ] `pnpm doctor` (env health)
- [ ] Confirm no new raw hex / crossed typography in touched UI files

---

## Lifecycle harness

- [ ] Selector lists all groups A–AP
- [ ] A/B open stories/auth
- [ ] C opens TrialFlow eligibility
- [ ] F–S / AO / AP home variants render distinct seeds
- [ ] V–AM commerce routes land correctly
- [ ] D/E/T/U/Y/Z/AA payment previews render
- [ ] States FAB works on `trial_home` / `commerce_profile` / `complete`
- [ ] Document reload requirement for stories/preview (FAB hidden)

---

## Onboarding — serviceability

- [ ] Empty / short / invalid pincode cannot continue
- [ ] Unserviceable (e.g. 411045) shows sorry state; meals disabled
- [ ] Serviceable (e.g. 400068) shows success; meals enabled
- [ ] Next blocked without meal selection
- [ ] Lunch / Dinner / Both each continue
- [ ] Serviceable areas list + search + select re-checks
- [ ] Coverage request does **not** mark pin serviceable
- [ ] Changing pincode clears meal selection

---

## Onboarding — preferences & routing

- [ ] Personal: Continue requires name + DOB + gender
- [ ] DOB sheet works on **iOS, Android, and web** (watch Keyboard APIs)
- [ ] **Veg / Non-veg must NOT open “Plan your three days”** when meal already chosen
- [ ] Mix of both **does** open mixMeals; Continue gated until complete
- [ ] Meal step skipped when eligibility already set meal
- [ ] Bread → rice → address ordering intact
- [ ] Intro skip-to-subscribe requires pin+meal; opens subscription on home

---

## Address — Lunch / Dinner / Both

- [ ] Lunch only: only lunch address collected
- [ ] Dinner only: only dinner address; no same-as-lunch sheet
- [ ] Both: lunch then dinner; same-as-lunch optional
- [ ] Save blocked when unavailable / missing flat / custom label empty
- [ ] Unserviceable map location cannot save
- [ ] Editing dinner does not mutate lunch (and reverse)
- [ ] Summary back returns to a valid step (**not** blank TrialHome)

---

## Trial at a glance / payment

- [ ] Both shows meal tabs; single meal has no tabs
- [ ] Preference cards + Proceed to Payment + View Breakup
- [ ] Breakup total matches CTA amount
- [ ] Payment → success → TrialHome

---

## Trial vs subscription meal detail

- [ ] Trial: no Change address / preference / Skip (unless product says otherwise)
- [ ] Trial: Report issue reachable for intended statuses
- [ ] Subscription future (before cutoff): address, preference, skip, report
- [ ] After cutoff: modifications blocked; undo unavailable
- [ ] Preference change **visible** in hero/subtitle (markers updated)
- [ ] Both plan: lunch edit does not overwrite dinner address/preference

---

## Skip / undo

- [ ] Skip extends end date by one eligible weekday
- [ ] Undo before cutoff restores meal + previous end date
- [ ] Multiple skips then undo earlier skip leaves end date correct
- [ ] Skipped styling (gray fill/border) on home markers

---

## Subscription sheet

- [ ] Lunch / Dinner / Both configs independent
- [ ] Both carousel does not mutate plan/price unexpectedly
- [ ] Footer total === breakup total
- [ ] Seeded home totals stay consistent with sheet math

---

## Commerce / loyalty

- [ ] Checkout / coupon / profile / addresses / settings routes
- [ ] Referral / streak / leaderboard / redeem screens render
- [ ] Cancel/pause sheet open/close

---

## Cross-cutting

- [ ] Light + dark on eligibility, address, home, subscription, commerce
- [ ] Small phone (≈320) and large phone layouts
- [ ] Keyboard does not cover sticky CTAs on pin / address / coverage
- [ ] Rapid double-tap CTAs do not double-navigate
- [ ] Console clean of page errors on web and native

---

## Known failing invariants (reconfirm until fixed)

1. Food `next()` skips meal onto `mixMeals` for non-mix food  
2. Summary back → `addressFlow` with null slot → TrialHome fallthrough  
3. Meal preference override not applied to `mealMarkers` display  
4. Both-plan address/preference stored meal-level (cross-slot overwrite)  
5. Multi-skip undo end-date stacking  
6. Web DOB: `Keyboard.default.metrics is not a function`  
7. Design-system hex / crossed typography / undefined token classes  
8. Demo address pincode `411045` vs serviceable mock set mismatch risk
