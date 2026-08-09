# State Machine Coverage

Generated: 2026-08-09  
Product code was not modified.

Legend for transition tests: **T** = exercised (interactive or logic harness), **C** = code-inspected only, **U** = untested / not reachable in this run.

---

## Machines discovered

| # | Machine | Source | Style |
| --- | --- | --- | --- |
| 1 | Lifecycle harness | `src/lifecycleStateMachine.ts` | reducer |
| 2 | Delivery eligibility | `src/deliveryEligibilityState.ts` | reducer + async check |
| 3 | Delivery address | `src/deliveryAddressState.ts` | reducer hook |
| 4 | Meal detail | `src/mealDetailState.ts` | phase reducer + guards |
| 5 | TrialFlow steps | `src/TrialFlow.tsx` | ordered step state |
| 6 | Auth sheet | `App.tsx` | `phone` → `otp` |
| 7 | Commerce routes | `src/CommerceProfileExperience.tsx` | stack of `Route` |

---

## 1. Lifecycle harness

**State:** `{ selectedState, destination }`  
**Initial:** `{ null, 'selector' }`  
**Events:** `SELECT_STATE`, `OPEN_SELECTOR`

### Destinations tested (interactive reload harness)

| State IDs | Destination | Result |
| --- | --- | --- |
| A | stories | PASS (auth sheet also opens from Get Started) |
| B | auth | PASS |
| C | onboarding | PASS |
| F–S, AO, AP | trial_home | PASS (variant UI observed) |
| D, E, T, Y, Z, AA | state_preview | Mostly PASS; **PAY-U** selector match landed on wrong UI (FAIL) |
| V–AM | commerce_profile | PASS |

### Transitions

```text
selector + SELECT_STATE{id} + definition.exists = destination(definition)
any + OPEN_SELECTOR = { null, selector }
```

**Harness gap (verified):** States FAB is hidden on `stories` and `preview` (`App.tsx`), so once those destinations open there is **no in-app return** to the selector without reload. Marked as P2 QA-harness issue.

---

## 2. Delivery eligibility

**Context fields:** `pincode`, `serviceability`, `serviceabilityResponse`, `mealSelection`, `serviceableAreasOpen`  
**Serviceability:** `idle | checking | serviceable | notServiceable | error`  
**Meal:** `lunch | dinner | both | null`

### Guard

```text
canContinueDeliveryEligibility
= pincode.length===6
+ isValidIndianPincodeFormat
+ serviceability==='serviceable'
+ mealSelection!==null
```

### Transitions

```text
* + SET_PINCODE = idle, mealSelection=null, response=null          [T]
idle/any + CHECK_PINCODE = checking, mealSelection=null            [C]
checking + PINCODE_SERVICEABLE = serviceable                       [T]
checking + PINCODE_NOT_SERVICEABLE = notServiceable, meal=null     [T]
checking + PINCODE_CHECK_FAILED = error, meal=null                 [C]
serviceable + SELECT_MEAL = mealSelection set                      [T]
!serviceable + SELECT_MEAL = no-op                                 [T] (logic)
* + OPEN/CLOSE_SERVICEABLE_AREAS = flag toggle                     [T]
* + SELECT_SERVICEABLE_AREA = checking + close areas + clear meal  [C]
```

### Guard both sides

| Condition | True | False |
| --- | --- | --- |
| Valid 6-digit pin | T (400068) | T (5 digits / empty) |
| Serviceable | T | T (411045) |
| Meal selected | T | T (Next blocked) |
| Leading zero pin | T (`012345` invalid format) | — |

---

## 3. Delivery address

**Phases:** `deliveryAddress` | `selectingSavedAddress` | `completed`  
**Modes:** `onboarding` | `meal-edit` | `add-address` | `subscription`  
**Availability:** `idle | checking | available | unavailable | error`  
**Coverage:** `idle | submitting | submitted | error`

### Save guard (`canSaveDeliveryAddress`)

```text
location.trim>2 + pincode.length===6 + availability==='available'
+ number.trim + (customLabel if labelType==='custom')
```

### Transitions (selected)

```text
deliveryAddress + LOCATION_SELECTED = update location/pincode, clear saved id     [C]
deliveryAddress + OPEN_SAVED_ADDRESSES = selectingSavedAddress                    [C]
selectingSavedAddress + SELECT_SAVED_ADDRESS = details from saved                 [C]
* + UPDATE_ADDRESS_DETAILS / SELECT_ADDRESS_LABEL / SET_CUSTOM_ADDRESS_LABEL      [C]
* + SET_PINCODE_AVAILABILITY                                                      [C]
* + OPEN_COVERAGE → SUBMIT → SUBMITTED/FAILED                                     [T partial / C]
* + ADDRESS_CONFIRMED = completed                                                 [C]
* + RESET = deliveryAddress initial                                               [C]
```

### Guard both sides

| Guard piece | True | False |
| --- | --- | --- |
| Location present | C | C (logic) |
| Availability available | C | C (unavailable blocks save) |
| Flat/number required | C | C |
| Custom label required when Others | C | C |

**Interactive address map/save on web:** NOT TESTABLE end-to-end in this run (blocked earlier by personal DOB / Keyboard.metrics; map is platform-split).

---

## 4. Meal detail

**Phases:** `viewing`, `editingAddress`, `checkingPincode`, `addressAvailable`, `addressUnavailable`, `editingMealPreference`, `confirmingSkip`, `skippingMeal`, `skipped`, `undoingSkip`, `reportingIssue`

**Events:** `CHANGE_ADDRESS`, `ADDRESS_UPDATED`, `CHECK_PINCODE`, `PINCODE_*`, `CHANGE_MEAL_PREFERENCE`, `MEAL_PREFERENCE_UPDATED`, `SKIP_MEAL`, `CONFIRM_SKIP`, `MEAL_SKIPPED`, `UNDO_SKIP`, `MEAL_SKIP_UNDONE`, `REPORT_ISSUE`, `CLOSE_FLOW`, `CUTOFF_REACHED`

### Guards (cutoff default `20:00` day before delivery)

| Guard | True case | False case | Method |
| --- | --- | --- | --- |
| `canChangeAddress` | future subscription slot before cutoff | trial / after cutoff / skipped / delivered | C (logic) |
| `canChangeMealPreference` | same as address | same | C |
| `canSkipMeal` | future sub slot | already skipped / trial / after cutoff | C |
| `canUndoSkip` | skipped + metadata + before cutoff | after cutoff / no metadata | C |
| `canReportIssue` | status ≠ inactive | inactive | C |
| `canModifyMealDelivery` | sub + future or undoable skip | trial | C |

### Action lists

```text
subscription → changeAddress, changeMealPreference, skipMeal, reportIssue (filtered by guards)
trial → reportIssue only
```

**UI inconsistency (C):** Upcoming trial meals compute `reportIssue` but `MealDetailSheet` only mounts report actions for skipped/delivered/cancelled paths — report missing for upcoming trial.

**Interactive:** Meal-detail deep open on AO was inconclusive (home chrome still visible); trial permission leak check did not show subscription-only actions on G (PASS for non-leak at surface level).

### Phase machine note

Reducer does **not** consult guards — UI must gate `send()`. `CUTOFF_REACHED` is a no-op on phase. Phase is not reset when swiping meal nav entries (C).

---

## 5. TrialFlow step machine

**Order:**  
`deliveryEligibility → personal → intro → food → meal → mixMeals → bread → rice → addressFlow → summary → payment → success → tracker`

### Intended branching

```text
food + meal already set → skip meal step
food preference !== Mix of both → skip mixMeals
meal Lunch → address slots [lunch]
meal Dinner → address slots [dinner]
meal Both → [lunch, dinner] sequential
intro skip-to-subscribe → tracker + open subscription (requires pin+meal)
```

### Critical transition defects (code + logic simulation)

```text
food + next() when data.meal set
= advances past meal onto mixMeals ALWAYS
≠ intended bread when food !== 'Mix of both'
→ P1 ONB-MIX-BUG (logic harness confirmed land === 'mixMeals')
```

```text
summary + back()
= addressFlow in order
+ addressFlowSlot often null after completion
= render falls through to TrialHome
→ P1 ONB-SUMMARY-BACK
```

| Transition | Status |
| --- | --- |
| eligibility → personal (Lunch/Dinner/Both) | T Lunch/Dinner; Both chip T |
| personal Continue gated | T (disabled without DOB) |
| food → calendar | BLOCKED on web (DOB Keyboard.metrics) |
| food → mixMeals bug | C + logic T |
| address Lunch only / Dinner only / Both | C |
| skip to subscribe | C |
| payment → success → tracker | C |

---

## 6. Auth sheet

```text
phone + valid submit = otp
otp + MOCK_OTP 123456 = TrialFlow (complete)
otp + invalid = remain
```

Interactive: auth sheet opened from A/B (PASS). Full OTP success path: NOT TESTABLE in automated run (did not complete OTP).

---

## 7. Commerce routes

Stack routes exercised via lifecycle selector (reload): checkout, coupon, coupon applied, profile, edit profile, addresses, transactions, settings, notifications, permissions, referral, loyalty (± completed), leaderboard, reward, redeem — **PASS** for destination render.

Cancel/pause sheet: C only.

---

## Coverage totals (approximate)

| Machine | States/phases discovered | Tested (T) | Code-only (C) | Untested deep branches |
| --- | --- | --- | --- | --- |
| Lifecycle | 42 IDs + selector | ~40 destinations | transitions helper | U auto-advance chains |
| Eligibility | 5 serviceability × meal | most | error/retry race | stale response race |
| Address | 3 phases + coverage | areas/coverage open | save/map | full save E2E |
| Meal detail | 11 phases + 5 guards | guard matrix logic | skip/undo E2E | cutoff wall-clock |
| TrialFlow | 13 steps | early steps | mix/address/summary bugs | full happy path web |
| Auth | 2 | open | OTP success | — |
| Commerce | 15 routes | 15 renders | nested sheets | form saves |

### Unreachable / dead

- `ENABLE_WEEKEND_ADDRESS_FLOW = false` weekend address path
- `OnboardingPlaceholder` unused
- `ConfirmDeliveryAddressSheet` unwired
- `SubscriptionPreferenceFlow` unused import graph

### Conflicting / missing

- Meal detail guards vs TrialHome UI for report-on-upcoming
- Preference override write vs marker display read
- Skip end-date metadata non-commutative under multi-skip
- Eligibility trusted re-entry skips re-check
