# Usage

Rules for how tokens get consumed in actual component code. This is the file Cursor should lean on most heavily when writing or reviewing JSX.

## 0. Font loading (required before anything below works)

Abril Fatface and Geist Mono aren't on-device fonts — they must be bundled and registered before `font-heading`/`font-body` classes will render correctly. Load them with `expo-font` at the app root and gate first paint on `fontsLoaded`:

```tsx
import { useFonts } from 'expo-font';

const [fontsLoaded] = useFonts({
  'AbrilFatface-Regular': require('./assets/fonts/AbrilFatface-Regular.ttf'),
  'GeistMono-Regular':    require('./assets/fonts/GeistMono-Regular.ttf'),
  'GeistMono-Medium':     require('./assets/fonts/GeistMono-Medium.ttf'),
  'GeistMono-SemiBold':   require('./assets/fonts/GeistMono-SemiBold.ttf'),
  'GeistMono-Bold':       require('./assets/fonts/GeistMono-Bold.ttf'),
});

if (!fontsLoaded) return null; // or a splash screen
```

`font-body` (the `weight-regular` default) maps to `GeistMono-Regular`. Heavier body text (`font-medium`, `font-semibold`, `font-bold` classes) needs its matching static weight file registered under a distinct family name — Geist Mono ships as separate static files per weight, not one variable font by default, so `font-body font-semibold` only renders correctly once `GeistMono-SemiBold` is loaded and wired into the theme's weight-to-family mapping in `global.css`. Abril Fatface ships one weight only — never apply `font-medium`/`font-bold` etc. to a `font-heading` element.

## 1. Golden rule

```tsx
// ❌ never
<View className="bg-[#0A0A0A] border-[#262626]">

// ❌ never — raw primitive in a component
<View className="bg-gray-950 border-gray-800">

// ✅ always — semantic token, works in both themes automatically
<View className="bg-background border-border">
```

If a design calls for a color that has no token yet, that's a signal to go add the token in `02-tokens.md` + `global.css` — not to reach for a raw value inline.

## 2. Screens

```tsx
<View className="flex-1 bg-background px-4">
  <Text className="font-heading text-heading-lg text-foreground">Title</Text>
  <Text className="font-body text-body-sm text-muted-foreground mt-1">Subtitle</Text>
</View>
```

- Screen root: `bg-background`, safe-area handled via `react-native-safe-area-context`, not manual padding.
- Horizontal screen padding is `px-4` (16px) as the default; only deviate with a comment explaining why.
- Screen/section titles get `font-heading` + a `text-heading-*` class. Everything else — body copy, labels, buttons, inputs — is `font-body` + a `text-body-*` class. There is no third font.

## 3. Buttons

| Variant | Classes |
|---|---|
| Primary | `bg-primary` `text-primary-foreground` `rounded-[--radius]` (or `rounded-lg` if intentionally larger) |
| Secondary | `bg-secondary` `text-secondary-foreground` `border border-border` |
| Destructive | `bg-destructive` `text-destructive-foreground` |
| Ghost / text | `bg-transparent` `text-primary` (no fill, no border) |

States:
- Pressed → `active:opacity-[--opacity-pressed]` (or `Pressable`'s `style={({pressed}) => ...}` if Uniwind's `active:` variant doesn't cover a given prop)
- Disabled → `opacity-[--opacity-disabled]` + `pointerEvents="none"`, never a separate "disabled gray" — reuse the existing surface with reduced opacity so it stays theme-correct.

```tsx
<Pressable className="bg-primary rounded-lg px-4 py-3 active:opacity-70 disabled:opacity-40">
  <Text className="font-body text-body-md font-medium text-primary-foreground text-center">Continue</Text>
</Pressable>
```

## 4. Cards / surfaces

```tsx
<View className="bg-card border border-border rounded-xl p-4 shadow-xs">
  <Text className="font-body text-body-md font-medium text-card-foreground">Row title</Text>
  <Text className="font-body text-body-sm text-muted-foreground">Row subtitle</Text>
</View>
```

- Card radius default: `rounded-xl` (16px) for content cards, `rounded-lg` (12px) for list rows/chips.
- Elevation ladder, low → high: `background` (no shadow, the floor) → `card shadow-xs` (resting cards, list rows) → `card shadow-sm` (raised/interactive card, e.g. a draggable item) → `card shadow-md` (sheets, modals while open) → `card shadow-lg` (FABs, toasts — things that float above everything).
- **Never stack more than one elevation step per surface.** A card inside a modal keeps its own `shadow-xs` or drops the shadow entirely — it does not also inherit the modal's `shadow-md`. If a component's parent already establishes elevation, the child should usually go elevation-flat (`shadow-none`, just a `border-border` hairline for definition instead).
- Flat surfaces (list rows inside a card, table cells) skip shadow entirely and rely on `border-border` dividers — reserve shadow for things that visually float above the base layer, not for every rectangle.

## 5. Inputs

```tsx
<TextInput
  className="bg-muted border border-border rounded-lg px-3 py-3 text-foreground
             focus:border-primary
             placeholder:text-muted-foreground"
  placeholder="Email"
/>
```

- Error state swaps `border-border` → `border-destructive`, and adds a `text-destructive text-xs mt-1` helper line below — never just a red border with no text explanation.
- Focus state uses `border-2 border-primary` (the "thick" border width token) rather than just a color swap — on native there's no browser focus ring to fall back on, so the width change is what actually signals focus.

### 5b. Auth sheet fields (`App.tsx`)

Phone input and OTP cells share one pattern via **`CenteredFieldInput`** (`src/centeredFieldInput.tsx`). **`bg-field`** for the fill (not `bg-surface`) so light and dark each resolve through `--color-field` — tune light independently; dark stays one step darker than `surface`.

```tsx
<CenteredFieldInput
  value={name}
  onChangeText={setName}
  placeholder="Your full name"
  selectionColor={foregroundColor}
  shellClassName={focused ? 'border border-foreground bg-canvas' : 'border border-transparent bg-field'}
  autoCapitalize="words"
  returnKeyType="next"
/>

// Phone row — pass +91 prefix
<CenteredFieldInput
  prefix={<><Text className={`${fieldValueTextClass} text-foreground`}>+91</Text><View className="h-6 w-px bg-foreground/15" /></>}
  ...
/>
```

**Typography:** field *values* use **`font-body-medium`** + `text-body-md` + `tracking-body-md`. Sheet titles stay `font-heading`; subtitles and legal copy stay `font-body` regular.

**Vertical centering (iOS):** keep every row child at one line tall (`h-6` / 24px leading). Center the row with `items-center` on the 52px shell — do **not** `self-stretch` the input column; iOS top-aligns text inside a stretched `TextInput`. Render visible digits with `Text`; stack a transparent `TextInput` (`color: 'transparent'`, `StyleSheet.absoluteFillObject`) on top for keyboard/caret. Match `fontFamily`, `fontSize`, `lineHeight`, and `letterSpacing` exactly between the two.

**OTP cells:** same `bg-field` / focus / error states; digit display uses `font-body-medium text-body-md tracking-body-md` inside `h-otp-cell rounded-field` boxes.

## 6. Icons

```tsx
<Search className="w-5 h-5 text-muted-foreground" />         {/* icon-sm, inline with body text */}
<Bell className="w-6 h-6 text-foreground" />                  {/* icon-md, nav bar action */}
<Home className="w-7 h-7 text-primary" />                     {/* icon-lg, tab bar, active */}
```

- Size follows context, not vibes: `icon-xs`/`icon-sm` (16–20px) sit inline with text; `icon-md` (24px) is the default for standalone tappable icons (nav bar, list-row leading icon); `icon-lg` (28px) is reserved for the tab bar; `icon-xl` (32px) only appears next to empty-state copy or similar illustration-adjacent contexts.
- Color always comes from a text-color token (`text-foreground`, `text-muted-foreground`, `text-primary`, `text-destructive`) passed through to the icon component — never a raw hex prop, even though most RN icon libraries accept a `color` prop directly instead of `className`. If the library doesn't read `className`, resolve the token to a value via `useTheme`/`tokens` (see the icon library's Uniwind interop docs) rather than hardcoding.
- A tappable icon is never just the icon — see §11 touch targets.

## 7. Avatars & images

```tsx
<Image source={{ uri }} className="w-10 h-10 rounded-full" />      {/* avatar-md */}
<Image source={{ uri }} className="w-full h-40 rounded-xl" />      {/* content thumbnail */}
```

- Avatars: `rounded-full`, sized per the `avatar-*` scale in `02-tokens.md`. Always pair with a fallback (initials on `bg-muted`, or a placeholder icon) for the loading/error state — never let a broken `Image` render as blank space.
- Non-avatar images/thumbnails: `rounded-lg`/`rounded-xl`, never `rounded-full` — circular crop is reserved for people/profile contexts so it stays a meaningful signal.

## 8. Status banners / toasts

Use the `-subtle` pair, not the solid status color, as the fill (solid status colors are for icons, dots, and small badges — not large surfaces, which get visually loud fast on mobile):

```tsx
<View className="bg-success-subtle rounded-lg p-3 flex-row items-center gap-2 shadow-sm">
  <CheckCircle className="w-5 h-5 text-success" />
  <Text className="font-body text-body-sm text-success-subtle-foreground flex-1">Payment successful</Text>
</View>
```

Toasts (transient, floating) take `shadow-lg` and a `z-toast` layer since they render above modals; inline banners (part of the scroll content) take no shadow at all.

## 9. Dark mode

Because tokens flip automatically, **do not write `dark:` prefixes for anything already tokenized.** `dark:` is reserved for genuine one-offs (e.g. an illustration asset that needs a different opacity in dark mode) and should carry a short comment explaining why it isn't a token.

```tsx
// ✅ automatic
<View className="bg-card" />

// ⚠️ only if truly a one-off, and comment why
<Image className="opacity-90 dark:opacity-70" /> {/* logo SVG has lower contrast on dark bg */}
```

## 10. Spacing & layout

- Use `gap-*` over manual `mt-*`/`ml-*` chains inside `flex-row`/`flex-col` wrappers wherever Uniwind supports it — fewer places for spacing bugs to hide.
- Vertical rhythm inside a screen: `gap-6` between major sections, `gap-3` between related items in a list, `gap-1.5` between a label and its value.
- Never hardcode a pixel margin/padding. If `space-*` doesn't have the value you need, that's a sign the design should be adjusted to the scale, not that the scale should be broken.

## 11. Touch targets

- Minimum hit area is 44×44px (`--size-touch-target-min`), regardless of how small the visible icon/text inside it is. A `w-4 h-4` (16px) icon button still needs the tap area padded out to 44×44 — use `hitSlop` on `Pressable`/`TouchableOpacity` rather than inflating the icon itself:

```tsx
<Pressable hitSlop={12} className="w-5 h-5 items-center justify-center">
  <X className="w-5 h-5 text-muted-foreground" />
</Pressable>
```
(20px visible + 12px hitSlop on each side ≈ 44px hit area.)

- Two adjacent tappable elements need at least 8px of visual gap even after hit-slop is accounted for, or their hit areas will overlap and cause mis-taps.

## 12. Motion

- Standard interactive transition (press, toggle, tab switch): `duration-fast` (150ms) with `ease-standard`.
- Sheet/modal enter-exit, layout changes: `duration-base` (250ms).
- Anything animating in from off-screen at length (onboarding illustrations, celebratory moments): `duration-slow` (400ms) — used sparingly, not for routine UI.
- Drive these through Reanimated (`withTiming(value, { duration: 150, easing: Easing.bezier(0.2, 0, 0, 1) })`), reading the ms/easing values from `01-primitives.md` rather than picking new numbers per animation — a codebase with a dozen slightly-different transition speeds feels inconsistent even if no single one is "wrong."

## 13. Loading, empty & error states

Every list/screen that fetches data needs all three, not just the happy path:

- **Loading** — skeleton shapes using `bg-muted` with a shimmer/pulse (Reanimated opacity loop, `duration-slow`), matching the actual content's layout (a skeleton row for a list, not a generic spinner, once initial load is done and it's a refresh).
- **Empty** — `icon-xl` (`text-muted-foreground`) + `font-heading text-heading-sm` short headline + `font-body text-body-sm text-muted-foreground` supporting line + an optional primary action button. Centered, generous vertical padding (`py-16` or more) so it doesn't read as a bug.
- **Error** — same layout as empty but the icon/headline signal failure specifically ("Couldn't load your orders", not a generic "Nothing here"), and it always includes a retry action — never a dead end.

## 14. Typography

- Screen title: `font-heading text-heading-lg text-foreground`
- Section header: `font-heading text-heading-sm text-foreground`
- Body: `font-body text-body-md text-foreground`
- **Field input value:** `font-body-medium text-body-md tracking-body-md text-foreground` (phone digits, OTP cells)
- Secondary/help text: `font-body text-body-sm text-muted-foreground`
- Caption/meta: `font-body text-body-xs text-muted-foreground`
- Never set `fontFamily`, `fontSize`, or `fontWeight` as one-off numbers — always through the paired classes above. `font-heading` never takes a weight modifier (single weight only); `font-body` takes `font-body-medium` / `font-mono-semibold` / `font-mono-bold` as needed, each of which must resolve to a loaded Geist Mono static weight file per §0. **Exception:** `TextInput` on RN still needs `fontFamily: 'GeistMono_500Medium'` in `StyleSheet` when using `font-body-medium` — Uniwind weight classes alone are unreliable on native inputs.

## 15. Anti-patterns to flag in review

- A raw hex, `rgb()`, or arbitrary Tailwind bracket value (`bg-[#...]`, `mt-[13px]`) in a component file.
- A new color introduced only in one screen instead of added to tokens.
- `dark:` prefixes duplicating logic that a token already handles.
- Inline `StyleSheet.create` used to reimplement something the className system already covers (acceptable only for things Uniwind genuinely can't express, e.g. certain native-driver animation values).
- A tappable element with no `hitSlop` and a visible area under 44×44.
- A shadow class on a surface that's already inside an elevated container (stacked elevation).
- A raw pixel icon size (`width: 22`) instead of one of the five `icon-*` steps.
- A list or data screen shipped with only the happy-path state — no loading, empty, or error handling.

## 16. What this system still doesn't cover

Flagging honestly rather than implying full coverage — extend as these come up:
- Component-level specs for navigation (tab bar height, header height, safe-area handling per screen type)
- Grid/breakpoint rules for tablet or foldable layouts
- Haptics conventions (which interactions get `expo-haptics` feedback and at what intensity)
- Form-level validation patterns beyond a single input's error state (multi-field forms, submit-button disabled logic)
- Accessibility beyond touch targets — VoiceOver/TalkBack label conventions, dynamic type scaling behavior for the two custom fonts
