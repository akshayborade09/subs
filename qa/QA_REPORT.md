# Full Application QA Report

**Date:** 2026-08-09  
**Orchestrator:** app-qa-orchestrator  
**Scope:** Entire repository (routes, screens, state machines, flows, design system)  
**Product code changes:** None  
**Artifacts:** `qa/APP_INVENTORY.md`, `qa/TEST_MATRIX.md`, `qa/STATE_MACHINE_COVERAGE.md`, `qa/REGRESSION_CHECKLIST.md`, `qa/artifacts/`

**Primary target:** Expo web at `http://localhost:8081`  
**Also used:** TypeScript check, Expo export, expo-doctor, reducer/guard logic harness, full code inspection

---

## Executive Summary

| Metric | Count |
| --- | ---: |
| Inventory screens/sheets/routes accounted | 70+ |
| Lifecycle states A–AP accounted | 42 |
| Matrix / executed checks (approx) | 110+ |
| Passed | 78 |
| Failed | 14 |
| Blocked | 12 |
| Not testable | 22 |
| Not implemented (tooling) | 2 |
| P0 defects | 0 |
| P1 defects | 7 |
| P2 defects | 8 |
| P3 defects | many (design-system bulk) |

### Release Assessment

```text
NOT READY
```

Core eligibility guards work, the app typechecks and exports, and most lifecycle destinations render. Release is blocked by **onboarding routing/navigation integrity bugs**, **Both-plan meal-data overwrite**, **preference UI not reflecting saves**, **skip/undo end-date stacking**, and a **web-breaking DOB Keyboard error** that prevents completing onboarding on the web target. Design-system debt is widespread but secondary to functional P1s.

---

## P0 Issues

_None confirmed._ App boots; eligibility happy/negative paths work; export succeeds.

---

## P1 Issues

### P1-01 — Vegetarian/Non-veg onboarding incorrectly enters mixMeals

| Field | Detail |
| --- | --- |
| Test ID | ONB-MIX-BUG |
| Feature | Trial onboarding routing |
| Preconditions | Eligibility already set Lunch/Dinner/Both; user picks Vegetarian or Non-vegetarian |
| Steps | Confirm three-day calendar (calls `next()` from `food`) |
| Expected | Skip `meal`, skip `mixMeals`, go to `bread` |
| Actual | `next()` advances past `meal` onto `mixMeals` for **any** food when `data.meal` is set |
| Relevant state | TrialFlow `step=food`, `data.meal` set, `data.food !== 'Mix of both'` |
| Files | `src/TrialFlow.tsx` (`next()` ~812; meal auto-skip effect ~869–874 only runs if step is `meal`) |
| Evidence | Logic simulation: `simulateNext('food', {meal:'Lunch'}) === 'mixMeals'` |
| Likely cause | Meal-skip branch increments into `mixMeals` without checking food preference |

### P1-02 — Summary Back exits to TrialHome

| Field | Detail |
| --- | --- |
| Test ID | ONB-SUMMARY-BACK |
| Feature | Trial onboarding back navigation |
| Preconditions | Address slots completed; `addressFlowSlot === null`; on summary |
| Steps | Press Back |
| Expected | Prior valid onboarding step (rice / last address) |
| Actual | Order back → `addressFlow` without slot → render fallthrough mounts `TrialHome` |
| Files | `src/TrialFlow.tsx` (~812, ~884, ~947) |
| Evidence | Code inspection of order + null-slot guard |
| Likely cause | Linear `order` back without restoring slot / skipping completed addressFlow |

### P1-03 — Both-plan address/preference overwrite across slots

| Field | Detail |
| --- | --- |
| Test ID | MEAL-BOTH-OVERWRITE |
| Feature | Subscription meal detail |
| Preconditions | `planBoth`; future lunch and dinner |
| Steps | Change lunch address or preference |
| Expected | Dinner slot unchanged |
| Actual | Overrides stored on meal (`deliveryAddressOverride`, `mealPreferenceOverride`), shared by both slots |
| Files | `src/TrialHome.tsx` (~1557–1608), contrast `subscriptionSheet.tsx` dual configs |
| Evidence | Code inspection |
| Likely cause | Slot-agnostic override fields |

### P1-04 — Meal preference save does not update visible markers

| Field | Detail |
| --- | --- |
| Test ID | MEAL-PREF-UI |
| Feature | Change meal preference |
| Preconditions | Subscription meal with `mealMarkers` |
| Steps | Change preference → save |
| Expected | Hero/subtitle show new preference |
| Actual | Write updates `mealPreferenceOverride`; display prefers `slotMarker.foodPreference` |
| Files | `src/TrialHome.tsx` (~1228–1229, ~1606–1608) |
| Evidence | Code inspection |
| Likely cause | Display precedence ignores override when markers exist |

### P1-05 — Multi-skip undo corrupts subscription end date

| Field | Detail |
| --- | --- |
| Test ID | MEAL-UNDO-STACK |
| Feature | Skip / undo |
| Preconditions | Two skips (e.g. lunch then dinner, or two days); end date extended twice |
| Steps | Undo the earlier skip |
| Expected | Remove only that extension; later skips remain coherent |
| Actual | Undo restores that skip’s `previousSubscriptionEndDate`, potentially erasing later extensions |
| Files | `src/TrialHome.tsx` (~1993, ~2031–2036), `src/mealDetailState.ts` metadata helpers |
| Evidence | Code inspection |
| Likely cause | Per-skip absolute previous end date, not stack/refcount of extensions |

### P1-06 — Web DOB sheet throws Keyboard.metrics

| Field | Detail |
| --- | --- |
| Test ID | ONB-DOB-WEB / CONSOLE-001 |
| Feature | Tell us about you |
| Preconditions | Web target; open Date of birth |
| Steps | Open DOB sheet |
| Expected | Usable date picker; Continue can enable |
| Actual | `TypeError: Keyboard.default.metrics is not a function`; Continue stays disabled without DOB → onboarding blocked on web |
| Files | DOB sheet path in `src/TrialFlow.tsx` / keyboard metrics usage in sheet chrome |
| Evidence | Playwright pageerror ×2; personal Continue remained disabled |
| Likely cause | RN Web Keyboard API gap |

### P1-07 — Report issue missing for upcoming trial meals

| Field | Detail |
| --- | --- |
| Test ID | MEAL-REPORT-TRIAL |
| Feature | Trial meal detail |
| Preconditions | Trial upcoming meal |
| Steps | Open meal detail |
| Expected | Report issue available (guard allows; trial action list includes it) |
| Actual | UI only mounts report list for skipped/delivered/cancelled |
| Files | `src/mealDetailState.ts` (`trialActions`), `src/TrialHome.tsx` (~1521–1531) |
| Evidence | Code inspection |
| Likely cause | Render path omits report for upcoming |

---

## P2 Issues

### P2-01 — States FAB hidden on stories/preview (no return path)

Harness cannot jump away from A/B/D/E/T/U/Y/Z/AA without reload. `App.tsx` ~766.

### P2-02 — Demo saved addresses use unserviceable pincode `411045`

`savedAddressesStore` demos vs mock serviceable set (`400068`…). Risk of confusing address availability tests.

### P2-03 — Home subscription total seed `5299` ≠ sheet monthly `5149`

`TrialHome.tsx` seed vs `subscriptionSheet` `calculateSubscriptionPricing`.

### P2-04 — Offline / paused copy vs modify still allowed

Guards still treat `paused` as modifiable future; offline does not hard-block edits.

### P2-05 — Trusted eligibility re-entry skips re-check

`initialTrusted` can restore serviceable without calling mock API.

### P2-06 — Geocode / address confirm stale closure risks

`DeliveryAddressFlow` geocode without cancellation; `handleAddressConfirmed` closes over render values.

### P2-07 — PAY-U selector automation mismatch

Selecting “Trial payment success” once landed on Trial scheduled UI (title/scroll collision or unexpected navigation). Needs manual confirm on preview chain.

### P2-08 — Design-system solid status colors / undefined classes

`bg-secondary`, `text-warning-foreground` undefined; widespread `#f59e0b` / `#dc2626` drift. See design-system section.

---

## P3 Issues

- Crossed typography: `font-heading text-body-md` (~9 sites)
- Arbitrary radii (`rounded-[20px]`, etc.)
- Duplicated foreground hex instead of `useForegroundColor`
- Lifecycle selector Tailwind yellow/red palette primitives
- Hardcoded “tomorrow” skip copy; subscription success next-meal hardcode
- Double upsert of saved addresses (flow + TrialFlow)
- Success confirmation address hardcode Baner suffix

Full token list: design-system audit notes in this report + agent findings.

---

## State Machine Coverage

See `qa/STATE_MACHINE_COVERAGE.md`.

Highlights:

- Eligibility guards tested both sides (interactive + logic)
- Meal-detail cutoff/skip/undo guards tested in logic harness
- TrialFlow critical bad transitions confirmed
- Address save guard logic PASS; full map E2E NOT TESTABLE this run
- Lifecycle destinations largely PASS via reload harness

---

## Flow Coverage

| Flow | Status |
| --- | --- |
| Boot / selector | PASS |
| Auth sheet open | PASS; OTP complete NOT TESTABLE |
| Eligibility + areas + coverage open | PASS |
| Personal form gate | PASS; DOB FAIL on web |
| Full onboarding happy path | BLOCKED (DOB) + FAIL (mixMeals/summary bugs by code) |
| Address Lunch/Dinner/Both E2E | NOT TESTABLE interactive; C reviewed |
| Trial home variants | PASS |
| Subscription home variants | PASS |
| Meal detail deep actions | BLOCKED interactive; C FAIL on invariants |
| Subscription sheet | C reviewed; interactive CTA NOT TESTABLE |
| Commerce / loyalty routes | PASS (render) |
| Payment preview cards | Mostly PASS |
| Dark mode exhaustive | BLOCKED |
| Native iOS/Android | NOT TESTABLE this run |

---

## Astryx / Design System Audit

**Separate from functional defects.**

| Severity | Approx |
| --- | ---: |
| P2 token/color violations | ~54 |
| P3 cleanup | ~62 |

Hotspots: `TrialHome.tsx`, `LifecycleStateSelector.tsx`, `deliveryAddressComponents.tsx`, `TrialFlow.tsx`, `subscriptionSheet.tsx`, `App.tsx`.

Intentional customs (not violations): accent ladder, success/warning soft fills, sheet spacing tokens, `skippedSurface` JS helpers, imagery `text-white` overlays.

`themeColors.ts` ↔ `global.css` drifts: placeholder opacity, dark field, ghost-on-field, missing destructive/warning JS mirrors.

---

## Accessibility Findings

| ID | Finding | Severity |
| --- | --- | --- |
| A11Y-01 | States FAB has accessibility label | OK |
| A11Y-02 | Systematic focus order / screen-reader pass not completed | BLOCKED |
| A11Y-03 | Icon-only and map controls need native pass | NOT TESTABLE |
| A11Y-04 | Disabled Continue not announced beyond visual | BLOCKED |

---

## Console / runtime evidence

- `TypeError: Keyboard.default.metrics is not a function` (web, DOB)
- Warnings: `pointerEvents` deprecation; `useNativeDriver` missing on web; `textShadow*` deprecation
- Screenshots under `qa/artifacts/` (boot, eligibility, personal, lifecycle homes, commerce, areas, responsive)

---

## Static project health

| Check | Result |
| --- | --- |
| `pnpm typecheck` | PASS |
| `pnpm export` | PASS → `dist/` |
| `pnpm doctor` | PASS (PATH warning for global pnpm bin) |
| Unit/E2E test suite | NOT IMPLEMENTED |
| Lint script | NOT IMPLEMENTED |

---

## Regression Risks (coupled areas)

1. Eligibility meal selection ↔ TrialFlow skip logic ↔ mixMeals ↔ address slots ↔ summary tabs  
2. Meal markers ↔ preference/address overrides ↔ skip metadata ↔ end date  
3. Subscription sheet dual configs ↔ home meal detail (currently inconsistent model)  
4. Serviceability mock set ↔ saved address demos ↔ map availability  
5. Lifecycle harness destinations ↔ TrialHome variant seeds  
6. Token changes in `global.css` without `themeColors.ts` updates  

---

## Recommended Fix Order

1. **P1-01** TrialFlow `next()` food→mixMeals routing  
2. **P1-02** Summary back / null `addressFlowSlot` fallthrough  
3. **P1-03 / P1-04** Per-slot overrides + marker display writes  
4. **P1-05** Skip/undo end-date stack semantics  
5. **P1-06** Web Keyboard/DOB  
6. **P1-07** Report issue upcoming UI  
7. P2 harness return path, price seed consistency, offline/paused policy  
8. Design-system status colors + typography pairs  
9. P3 polish  

---

## Completeness statement

Accounted for in inventory:

- All `AppFlow` screens  
- Lifecycle states A–AP  
- TrialFlow steps (including disabled weekend path)  
- Home / subscription / commerce routes and major sheets  
- Four primary reducers + local step machines  
- Design-system sources  

Anything not interactively proven is **FAIL** (when code proves defect), **BLOCKED**, or **NOT TESTABLE** — never silent PASS.

Native iOS/Android gesture, real maps, wall-clock cutoff, and full onboarding payment path remain **NOT TESTABLE** on this web-focused run and must be re-run on device before production.
