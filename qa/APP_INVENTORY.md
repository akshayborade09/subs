# Application Inventory

Generated: 2026-08-09  
Scope: Full repository discovery (not limited to recent changes)  
Target under test: Expo web (`http://localhost:8081`) + static/code inspection  
Product code was **not** modified during this audit.

---

## Project profile

| Item | Detail |
| --- | --- |
| Framework | React Native 0.81.5 + Expo ~54 |
| React | 19.1.0 (+ react-dom / react-native-web) |
| Styling | Uniwind + Tailwind v4 (`global.css`) |
| Package manager | pnpm |
| Entry | `index.ts` → `App.tsx` |
| Router | **None** (local `Screen` state in `AppFlow`) |
| Backend | Mock / in-memory only |
| Automated tests | **None** (Playwright present as dependency; no specs) |
| Scripts | `start`, `ios`, `android`, `web`, `export`, `typecheck`, `doctor`, EAS build/update |

---

## Top-level navigation (`App.tsx`)

`Screen`: `selector` | `stories` | `complete` | `trial_home` | `preview` | `commerce_profile`

| Screen | Component | Entry conditions | Exit paths |
| --- | --- | --- | --- |
| `selector` | `LifecycleStateSelector` | Cold start / `OPEN_SELECTOR` / States FAB | Select lifecycle state A–AP |
| `stories` | `OnboardingScreen` | States A (stories), B (auth) | Get Started → auth sheet; OTP → `complete` |
| `complete` | `TrialFlow` | State C / OTP verified | Success/skip → `TrialHome` |
| `trial_home` | `TrialHome` | States F–S, AO, AP + post-onboarding | Profile / My Plan → commerce; sheets |
| `preview` | `LifecycleExperience` | States D, E, T, U, Y, Z, AA | Primary/secondary actions → next state |
| `commerce_profile` | `CommerceProfileExperience` | States V–AM + home profile | Back → prior home state |

Lifecycle destinations: `stories` | `auth` | `onboarding` | `trial_home` | `state_preview` | `commerce_profile`

---

## Screens, sheets, and modals

### Entry / auth

| UI | Kind | Classification | File |
| --- | --- | --- | --- |
| Lifecycle state selector | Full screen | supporting / QA harness | `src/LifecycleStateSelector.tsx` |
| Onboarding stories (5) | Full screen | onboarding | `App.tsx` (`OnboardingScreen`) |
| Login / Create account | Bottom sheet | onboarding | `App.tsx` (`LoginSheet`: phone → otp) |
| Lifecycle payment preview | Full screen | supporting | `src/LifecycleExperience.tsx` |
| OnboardingPlaceholder | Unused | supporting | `App.tsx` (defined, not mounted) |

### Trial onboarding (`TrialFlow`)

| Step / UI | Kind | Classification | File |
| --- | --- | --- | --- |
| Delivery availability | Full screen | onboarding | `deliveryEligibilityScreen.tsx` |
| Serviceable areas | Sticky panel | onboarding | `deliveryEligibilityScreen.tsx` |
| Request coverage | Sheet | onboarding | `deliveryAddressComponents.tsx` (`DeliveryCoverageSheet`) |
| Tell us about you | Full screen | onboarding | `TrialFlow.tsx` |
| DOB picker | Sheet | onboarding | `TrialFlow.tsx` (`DateSheet`) |
| Trial intro | Full screen | onboarding | `TrialFlow.tsx` (`TrialIntro`) |
| Food preference | Full screen | onboarding | `TrialFlow.tsx` |
| Trial calendar | Sheet | onboarding | `TrialFlow.tsx` (`TrialCalendarSheet`) |
| Choose meals | Full screen (often skipped) | onboarding | `TrialFlow.tsx` |
| Plan your three days (mix) | Full screen | onboarding | `TrialFlow.tsx` |
| Bread preference | Full screen | onboarding | `TrialFlow.tsx` |
| Rice preference | Full screen | onboarding | `TrialFlow.tsx` |
| Delivery address (per slot) | Full screen | delivery | `DeliveryAddressFlow.tsx` |
| Search location | Overlay | delivery | `deliveryAddressComponents.tsx` |
| Saved addresses | Sheet | delivery | `deliveryAddressComponents.tsx` |
| Same as reference meal | Sheet | delivery | `deliveryAddressComponents.tsx` |
| Delete address confirm | Nested sheet | delivery | `deliveryAddressComponents.tsx` |
| Trial at a glance | Full screen | trial | `trialOnboardingSummary.tsx` |
| Price breakup | Sheet | trial | `trialOnboardingSummary.tsx` |
| Complete payment | Full screen | payment | `TrialFlow.tsx` |
| Trial confirmation | Full screen | trial | `TrialFlow.tsx` |
| Legacy calendars / weekend sheets | Dead / unused paths | supporting | `TrialFlow.tsx` (`ENABLE_WEEKEND_ADDRESS_FLOW = false`) |

### Home / meal management (`TrialHome`)

| UI | Kind | Classification | File |
| --- | --- | --- | --- |
| Trial / subscription home | Full screen | home | `TrialHome.tsx` |
| Meal detail | Full-screen sheet | meal management | `TrialHome.tsx` |
| Issue sheet | Nested sheet | meal management | `TrialHome.tsx` |
| Skip meal sheet | Nested sheet | meal management | `TrialHome.tsx` |
| Preference picker | Modal | meal management | `subscriptionPreferencePickerModal.tsx` |
| Plan details | Sheet | subscription | `TrialHome.tsx` |
| Plan restart date | Sheet | subscription | `planRestartDateSheet.tsx` |
| Subscription sheet | Full-height sheet | subscription | `subscriptionSheet.tsx` |
| Subscription price breakup | Nested sheet | subscription | `subscriptionSheet.tsx` |
| Glass tab bar | Chrome | home | `TrialHome.tsx` |

### Commerce / profile (`CommerceProfileExperience`)

Routes: `checkout` | `coupon` | `profile` | `my_plan` | `edit_profile` | `addresses` | `transactions` | `settings` | `notifications` | `permissions` | `referral` | `loyalty` | `leaderboard` | `reward` | `redeem`

| UI | Classification | File |
| --- | --- | --- |
| Review subscription | payment | `CommerceProfileExperience.tsx` |
| Apply coupon | payment | same |
| Profile hub | profile/account | same |
| My plan | subscription | same |
| Edit profile | profile/account | same |
| Saved addresses | delivery | same |
| Transactions | profile/account | same |
| Settings / notifications / permissions | profile/account | same |
| Refer & earn | supporting | same |
| Healthy Streak / leaderboard / reward / redeem | supporting | same |
| Cancel / pause plan | bottom sheet | same |

### Orphan / unused exports

| Item | Notes |
| --- | --- |
| `SubscriptionPreferenceFlow.tsx` | Exported; not imported elsewhere |
| `FoodPreferencePicker.tsx` | Shared picker; limited wiring |
| `ConfirmDeliveryAddressSheet` | Exported; not wired into current address flow |

---

## State machines / reducers

| Machine | File | Role |
| --- | --- | --- |
| Lifecycle | `lifecycleStateMachine.ts` | QA harness destinations A–AP |
| Delivery eligibility | `deliveryEligibilityState.ts` | Pincode + meal selection |
| Delivery address | `deliveryAddressState.ts` | Address phase + coverage |
| Meal detail | `mealDetailState.ts` | Skip / undo / address / preference / issue phases + guards |
| TrialFlow step order | `TrialFlow.tsx` local state | Onboarding step machine |
| Auth sheet | `App.tsx` local state | phone → otp |
| Commerce stack | `CommerceProfileExperience.tsx` | Route stack |

See `qa/STATE_MACHINE_COVERAGE.md` for transitions and guards.

---

## Design system

| Layer | Path |
| --- | --- |
| Docs | `docs/00-overview.md`, `01-primitives.md`, `02-tokens.md`, `03-usage.md` |
| Runtime | `global.css` (`@theme`, light/dark variants) |
| JS mirrors | `src/themeColors.ts` |
| Rules | `.cursor/rules/design-system-core.mdc` |

Fonts: DM Serif Text (`font-heading`), Inclusive Sans (`font-body`).

---

## Mock data / stores

| Store | File | Notes |
| --- | --- | --- |
| OTP | `App.tsx` `MOCK_OTP = '123456'` | Preview verify |
| Serviceable areas | `deliveryServiceability.ts` | `400068`, `400101`, `400100`, `400051`, `400081` |
| Coverage requests | `coverageRequestStore.ts` | In-memory |
| Saved addresses | `savedAddressesStore.tsx` | Demo Home/Office (`411045`) |
| Home meals / plans | `TrialHome.tsx` demo seeders | Lifecycle-variant driven |
| Commerce copy | `CommerceProfileExperience.tsx` | Hardcoded |

---

## Lunch / Dinner / Both branching map

| Surface | Behavior |
| --- | --- |
| Eligibility chips | `lunch` \| `dinner` \| `both` |
| mixMeals plan | Slot rows depend on meal label |
| Address slots | Lunch→`[lunch]`; Dinner→`[dinner]`; Both→`[lunch,dinner]` sequential |
| Trial summary | Tabs only when Both |
| Subscription sheet | Dual configs + carousel when Both |
| Home tracker | Dual markers when Both |
| Meal detail guards | Slot-aware skip/undo when `planBoth` |

---

## User journeys (discovered)

```text
A stories → Get Started → phone → OTP 123456 → TrialFlow
C onboarding → TrialFlow (resume)
TrialFlow: eligibility → personal → intro → food(+calendar) → [meal] → [mixMeals] → bread → rice → address(es) → summary → payment → success → TrialHome
Intro skip-to-subscribe → TrialHome + SubscriptionSheet (defaults prefs; skips address/payment)
G TrialHome → Avail Subscription → SubscriptionSheet → activated home
Home → Profile/My Plan → CommerceProfileExperience
Selector → any A–AP destination for state preview
```

---

## Test infrastructure inventory

| Capability | Status |
| --- | --- |
| Unit / integration tests | Absent |
| E2E specs | Absent |
| Playwright dependency | Present (`1.49.0`); browsers may need install |
| Typecheck | `pnpm typecheck` |
| Lint | No dedicated lint script |
| Doctor | `pnpm doctor` |
| Build | `pnpm export` / EAS profiles |

---

## Inventory completeness

Discovered and accounted for:

- All top-level `AppFlow` screens
- All lifecycle destinations A–AP
- All TrialFlow steps (including unused weekend path flag)
- All major home / subscription / commerce routes and sheets
- All four primary reducers + local step machines
- Design-system sources and mock stores

Anything not interactively exercised is marked BLOCKED / NOT TESTABLE in the matrix and report — never as PASS.
