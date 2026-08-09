# Primitives

Raw values only. Nothing here carries meaning — no primitive should be named after where it's used (no `button-blue`, no `error-red`). Primitives are consumed exclusively by `global.css` when building tokens; components never reference them directly.

## 1. Color ramps

Each ramp runs 50 (lightest) → 950 (darkest), 11 steps. Adjust hues to brand; keep the step logic.

```
gray-50   #FAFAFA      gray-500  #737373
gray-100  #F5F5F5      gray-600  #525252
gray-200  #E5E5E5      gray-700  #404040
gray-300  #D4D4D4      gray-800  #262626
gray-400  #A3A3A3      gray-900  #171717
                        gray-950  #0A0A0A

brand-50  #EEF2FF      brand-500 #6366F1
brand-100 #E0E7FF      brand-600 #4F46E5
brand-200 #C7D2FE      brand-700 #4338CA
brand-300 #A5B4FC      brand-800 #3730A3
brand-400 #818CF8      brand-900 #312E81
                        brand-950 #1E1B4B

success-50  #ECFDF5    success-500 #10B981    success-900 #064E3B
warning-50  #FFFBEB    warning-500 #F59E0B    warning-900 #78350F
danger-50   #FEF2F2    danger-500  #EF4444    danger-900  #7F1D1D
info-50     #EFF6FF    info-500    #3B82F6    info-900    #1E3A8A
```

> Replace `brand-*` with your actual brand hue. Keep `success` / `warning` / `danger` / `info` ramps hue-locked (green/amber/red/blue family) regardless of brand — status color shouldn't be ambiguous.

## 2. Spacing scale

Base unit `4px`. Use this scale for margin, padding, gap — never an arbitrary pixel value in a component.

```
space-0   0px       space-6   24px
space-px  1px       space-8   32px
space-0.5 2px       space-10  40px
space-1   4px       space-12  48px
space-1.5 6px       space-14  56px
space-2   8px       space-16  64px
space-2.5 10px      space-20  80px
space-3   12px      space-24  96px
space-4   16px      space-32  128px
space-5   20px
```

## 3. Radius scale

```
radius-none 0px
radius-sm   4px
radius-md   8px
radius-lg   12px
radius-xl   16px
radius-2xl  24px
radius-full 9999px
```

## 4. Font families

Two families, one job each — matches Astryx's `typography.heading` / `typography.body` split.

```
font-heading — DM Serif Text   (display serif, headings only, one weight: 400)
font-body    — Inclusive Sans  (UI text: body, labels, inputs, buttons, captions)
```

DM Serif Text ships one weight (400) and is decorative — never use it below `text-lg`, never for paragraphs, never for anything the user has to read quickly (form labels, error messages, button text). Inclusive Sans carries the rest of the UI, including body copy, labels, buttons, and monetary values.

Neither font ships on-device. Both must be bundled and loaded through `expo-font` before first paint (see `03-usage.md` §0 for the loading pattern) — referencing `font-heading`/`font-body` before the fonts finish loading will silently fall back to the OS default, so gate your root render on `useFonts` readiness.

## 5. Typography scale

Sizes paired with default line-height and tracking. Two scale tracks — heading (DM Serif Text) and body (Inclusive Sans) — because a display serif and a sans face carry weight differently at the same pixel size; don't share one scale across both. Every heading size carries −1% tracking baked into the size token, so `text-heading-*` alone is enough — no separate `tracking-*` class on headings.

```
Heading track (font-heading, weight fixed at 400, tracking −1%)
text-heading-sm   18px / 25px / -0.18px
text-heading-md   22px / 30px / -0.22px
text-heading-lg   36px / 42px
text-heading-xl   44px / 48px / -0.44px

Body track (font-body, weight varies)
text-body-xs      12px / 18px
text-body-sm      14px / 20px
text-body-md      16px / 24px
text-body-lg      18px / 26px
```

Weights (body track only — heading track is a single fixed weight): `weight-regular 400` · `weight-medium 500` · `weight-semibold 600` · `weight-bold 700`

## 5. Elevation / shadow

React Native shadows don't render identically cross-platform — define per-platform in `global.css`, but keep a single semantic step count:

```
shadow-none
shadow-xs   — resting cards, list rows
shadow-sm   — raised buttons, chips
shadow-md   — modals, sheets while open
shadow-lg   — floating action buttons, toasts
```

## 6. Icon sizes

Icons are square, sized off the same base-4 rhythm as spacing so an icon always lines up with the text/padding around it without a one-off value:

```
icon-xs  16px  — inline with text-body-xs/sm, dense list rows
icon-sm  20px  — inline with text-body-md, default inline icon size
icon-md  24px  — standalone icons: nav bar actions, list-row leading icons
icon-lg  28px  — tab bar icons
icon-xl  32px  — empty-state / illustration-adjacent icons
```

## 7. Border width

```
border-width-hairline  1px (StyleSheet.hairlineWidth on native, not a flat 1px — see 02-tokens.md)
border-width-thick     2px  — focused inputs, selected chip outline
```

## 8. Touch target minimum

```
touch-target-min  44px  — iOS HIG minimum; also satisfies Android's 48dp when combined with 8dp density baseline
```
Applies to the *hit area*, not necessarily the visible element — a 16px icon button still needs a 44×44 hit slop around it.

## 9. Avatar / image sizes

```
avatar-xs  24px  — inline mentions, compact lists
avatar-sm  32px  — list rows, comment threads
avatar-md  40px  — default profile contexts, headers
avatar-lg  56px  — profile screens
avatar-xl  96px  — profile edit / detail hero
```

## 10. Opacity

```
opacity-disabled  0.4
opacity-pressed   0.7
opacity-overlay   0.5
```

## 11. Z-index

```
z-base     0
z-sticky   10
z-dropdown 20
z-overlay  30
z-modal    40
z-toast    50
```

## 12. Motion (durations/easings, for use with Reanimated)

```
duration-fast   150ms
duration-base   250ms
duration-slow   400ms

ease-standard   cubic-bezier(0.2, 0, 0, 1)
ease-decelerate cubic-bezier(0, 0, 0, 1)
ease-accelerate cubic-bezier(0.3, 0, 1, 1)
```
