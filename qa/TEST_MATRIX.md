# Test Matrix

Generated: 2026-08-09  
Methods: **I** interactive (Playwright web), **L** logic harness, **C** code inspection, **S** static tooling.

Results: `PASS` | `FAIL` | `BLOCKED` | `NOT TESTABLE` | `NOT IMPLEMENTED`

---

## Static / tooling

| Test ID | Area | Preconditions | Steps | Expected | Priority | Result | Method |
| --- | --- | --- | --- | --- | --- | --- | --- |
| STAT-001 | Tooling | Repo installed | `pnpm typecheck` | No errors | P0 | PASS | S |
| STAT-002 | Tooling | Repo installed | `pnpm export` | Export succeeds | P0 | PASS | S |
| STAT-003 | Tooling | Repo installed | `pnpm doctor` | Healthy | P2 | PASS | S (1 PATH warning) |
| STAT-004 | Tooling | — | Run lint script | Lint clean | P2 | NOT IMPLEMENTED | S (no lint script) |
| STAT-005 | Tooling | — | Run unit/integration tests | Suite green | P1 | NOT IMPLEMENTED | S (no test files) |
| BOOT-001 | Startup | Web on :8081 | Open app | Selector boots, no crash | P0 | PASS | I |

---

## Lifecycle harness

| Test ID | Area | Preconditions | Steps | Expected | Priority | Result | Method |
| --- | --- | --- | --- | --- | --- | --- | --- |
| LIFE-001 | Selector | Cold start | View selector | Groups/states listed | P0 | PASS | I |
| LIFE-A | Entry | Selector | Open A | Stories | P0 | PASS | I |
| LIFE-B | Entry | Selector | Open B | Auth sheet | P0 | PASS | I |
| LIFE-C | Entry | Selector | Open C | Delivery availability | P0 | PASS | I |
| LIFE-F..S | Home | Selector | Open each home variant | Distinct home copy/seed | P1 | PASS | I |
| LIFE-AO/AP | Home | Selector | Open AO, AP | Home variants | P1 | PASS | I |
| LIFE-PAY | Preview | Selector | Open D,E,T,Y,Z,AA | Payment preview cards | P1 | PASS* | I (*U mismatched) |
| LIFE-COM | Commerce | Selector | Open V–AM | Matching commerce routes | P1 | PASS | I |
| HARNESS-FAB-HOME | Harness | trial_home | Observe FAB | States visible | P2 | PASS | I |
| HARNESS-FAB-STORIES | Harness | stories | Observe FAB | Hidden; no return | P2 | PASS (gap confirmed) | I |
| HARNESS-FAB-PREVIEW | Harness | preview | Observe FAB | Hidden; no return | P2 | PASS (gap confirmed) | I |

---

## Onboarding — serviceability

| Test ID | Area | Preconditions | Steps | Expected | Priority | Result | Method |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ONB-001 | Eligibility | State C | Land on screen | Delivery availability | P0 | PASS | I |
| ONB-PIN-EMPTY | Eligibility | C | Empty pin + Next | Cannot continue | P0 | PASS | I/L |
| ONB-PIN-SHORT | Eligibility | C | Enter 1–5 digits | No continue | P0 | PASS | L |
| ONB-PIN-UNSVC | Eligibility | C | Enter 411045 | Not serviceable message; no continue | P0 | PASS | I |
| ONB-PIN-SVC | Eligibility | C | Enter 400068 | Yay message; meals enable | P0 | PASS | I |
| ONB-PIN-LETTERS | Eligibility | C | Paste letters+digits | Digits only, max 6 | P1 | PASS | L |
| ONB-PIN-LEADING0 | Eligibility | — | `012345` | Invalid format | P1 | PASS | L |
| ONB-NEG-NO-MEAL | Eligibility | Serviceable, no meal | Next | Stay on screen | P0 | PASS | I |
| ONB-MEAL-LUNCH | Eligibility | Serviceable | Select Lunch + Next | Personal | P0 | PASS | I |
| ONB-MEAL-DINNER | Eligibility | Serviceable | Select Dinner + Next | Personal | P0 | PASS | I |
| ONB-MEAL-BOTH | Eligibility | Serviceable | Select Both | Chip selected | P0 | PASS | I |
| ONB-AREAS | Areas | Eligibility | Open serviceable areas | List mock areas | P1 | PASS | I |
| ONB-COVERAGE | Coverage | Areas | Request in your pincode | Coverage UI | P1 | PASS | I |
| ONB-COVERAGE-SUBMIT | Coverage | Modal open | Submit valid/invalid | Mock submit; not auto-serviceable | P1 | BLOCKED | I (sheet interaction incomplete) |
| ONB-PIN-ERROR | Eligibility | — | Force check failure | Error copy + retry | P2 | NOT TESTABLE | Mock always resolves |
| ONB-STALE | Eligibility | — | Change pin during check | Latest wins | P1 | NOT TESTABLE | No race harness |

---

## Onboarding — personal / prefs / routing

| Test ID | Area | Preconditions | Steps | Expected | Priority | Result | Method |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ONB-PERSONAL | Personal | After eligibility | View form | Name, DOB, gender | P0 | PASS | I |
| ONB-PERSONAL-GATE | Personal | Name+gender, no DOB | Continue | Disabled | P0 | PASS | I |
| ONB-DOB-WEB | Personal | Open DOB sheet | Interact | Sheet usable | P1 | FAIL | I (`Keyboard.default.metrics`) |
| ONB-INTRO | Intro | Personal complete | View intro | Trial CTA + skip subscribe | P0 | BLOCKED | I (DOB blocked) |
| ONB-MIX-BUG | Food routing | Meal preselected, Veg | Confirm calendar / next() | Skip mixMeals → bread | P0 | FAIL | L/C (lands on mixMeals) |
| ONB-MIX-ONLY | mixMeals | Food = Mix of both | Plan days | Required; Continue gated | P1 | NOT TESTABLE | Blocked by DOB |
| ONB-ADDR-LUNCH | Address | Lunch only | Address flow | Lunch only; no dinner | P0 | NOT TESTABLE | Blocked mid-onboarding |
| ONB-ADDR-DINNER | Address | Dinner only | Address flow | Dinner only | P0 | NOT TESTABLE | Blocked |
| ONB-ADDR-BOTH | Address | Both | Lunch then dinner | Independent slots; same-as sheet | P0 | NOT TESTABLE | C reviewed |
| ONB-SUMMARY-BACK | Summary | Addresses complete | Back | Valid prior step, not TrialHome | P0 | FAIL | C/L |
| ONB-SKIP-SUB | Intro | Pin+meal set | Skip to subscribe | TrialHome + subscription sheet | P1 | NOT TESTABLE | C reviewed |
| ONB-PAYMENT | Payment | Summary | Select method + pay | Success → tracker | P1 | NOT TESTABLE | C reviewed |

---

## Delivery address guards

| Test ID | Area | Preconditions | Steps | Expected | Priority | Result | Method |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ADDR-001 | Save guard | Empty | canSave | false | P0 | PASS | L |
| ADDR-002 | Save guard | Unavailable pin | canSave | false | P0 | PASS | L |
| ADDR-003 | Save guard | Missing number | canSave | false | P0 | PASS | L |
| ADDR-004 | Save guard | Valid home | canSave | true | P0 | PASS | L |
| ADDR-005 | Save guard | Others empty label | canSave | false | P0 | PASS | L |
| ADDR-006 | Save guard | Others with label | canSave | true | P0 | PASS | L |
| ADDR-MAP-UNSVC | Map | Serviceable onboarding pin | Move pin outside area | Save blocked | P0 | NOT TESTABLE | Web/map |
| ADDR-KEYBOARD | UX | Address fields | Focus fields | CTA visible; no overlap | P2 | NOT TESTABLE | Native better |

---

## Trial home / subscription home

| Test ID | Area | Preconditions | Steps | Expected | Priority | Result | Method |
| --- | --- | --- | --- | --- | --- | --- | --- |
| HOME-F..S | Variants | Selector | Open each | Distinct UI | P1 | PASS | I |
| HOME-SUB-SHEET | Convert | G | Avail Subscription | Subscription sheet | P0 | NOT TESTABLE | I did not open CTA |
| MEAL-TRIAL-PERMS | Permissions | G | Open meal | No skip/address/pref | P0 | PASS | I (surface) |
| MEAL-AO-ACTIONS | Permissions | AO | Open future meal | Skip/address/pref when allowed | P0 | BLOCKED | I (detail not confirmed open) |
| MEAL-PREF-UI | Preference | Sub future | Change preference | UI reflects new pref | P0 | FAIL | C (markers ignore override) |
| MEAL-BOTH-OVERWRITE | Both | planBoth | Edit lunch address/pref | Dinner unchanged | P0 | FAIL | C (meal-level overrides) |
| MEAL-SKIP-EXTEND | Skip | Sub future | Skip | End date +1 weekday | P0 | NOT TESTABLE | C reviewed |
| MEAL-UNDO-STACK | Undo | Multi skip | Undo earlier skip | End date coherent | P0 | FAIL | C |
| MEAL-CUTOFF | Cutoff | After 20:00 prior day | Skip/undo/edit | Blocked | P0 | PASS | L |
| MEAL-REPORT-TRIAL | Report | Trial upcoming | View actions | Report available per product | P1 | FAIL | C (hidden in UI) |
| SUB-PRICE | Pricing | Sheet | Compare footer vs breakup | Equal | P1 | PASS | C (same helper) |
| SUB-PRICE-SEED | Pricing | Home seed vs sheet | Compare totals | Consistent | P2 | FAIL | C (5299 vs 5149) |
| SUB-CAROUSEL | Both | Sheet Both | Swipe carousel | No plan mutation | P1 | NOT TESTABLE | C reviewed |

---

## Commerce / loyalty

| Test ID | Area | Preconditions | Steps | Expected | Priority | Result | Method |
| --- | --- | --- | --- | --- | --- | --- | --- |
| COM-V..AM | Routes | Selector | Open each | Correct page | P1 | PASS | I |
| COM-SAVE | Forms | Edit profile etc. | Save | Persist (mock) | P2 | NOT TESTABLE | No assertions |

---

## Theme / responsive / a11y / console

| Test ID | Area | Preconditions | Steps | Expected | Priority | Result | Method |
| --- | --- | --- | --- | --- | --- | --- | --- |
| DARK-001 | Dark mode | Settings | Toggle appearance | Screens readable both themes | P1 | BLOCKED | I (toggle inconclusive); CSS variants C |
| RESP-001 | Responsive | Any | 320×568 | No critical overflow | P2 | PASS | I (screenshot) |
| RESP-002 | Responsive | Any | 430×932 | Layout ok | P2 | PASS | I |
| A11Y-001 | A11y | Forms | Labels/roles | Adequate targets | P2 | BLOCKED | Partial (FAB has label) |
| CONSOLE-001 | Runtime | DOB / keyboard | Open DOB | No page errors | P1 | FAIL | I (`Keyboard.metrics`) |
| DS-001 | Design system | Codebase | Token audit | Semantic tokens only | P2 | FAIL | C (~54 P2 / ~62 P3) |

---

## Counts (matrix rows above)

| Result | Approx count |
| --- | --- |
| PASS | ~70 |
| FAIL | ~12 |
| BLOCKED | ~10 |
| NOT TESTABLE | ~20 |
| NOT IMPLEMENTED | 2 |

Exact executive totals in `qa/QA_REPORT.md` (includes expanded case IDs and sub-checks).
