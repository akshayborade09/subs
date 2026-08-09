# Tokens

Semantic layer. Naming follows **Tailwind v4 / Uniwind's own convention** — every token is declared under the theme namespace Tailwind already knows how to turn into a utility class, so nothing here requires a plugin, a config mapping, or memorizing a second naming system on top of Tailwind:

| Theme namespace | Auto-generates | Example |
|---|---|---|
| `--color-{name}` | `bg-{name}`, `text-{name}`, `border-{name}`, `fill-{name}`... | `--color-primary` → `bg-primary` |
| `--font-{name}` | `font-{name}` (font-family utility) | `--font-heading` → `font-heading` |
| `--text-{name}` + `--text-{name}--line-height` | `text-{name}` (size + leading together) | `--text-heading-lg` → `text-heading-lg` |
| `--radius-{name}` | `rounded-{name}` | `--radius-lg` → `rounded-lg` |
| `--shadow-{name}` | `shadow-{name}` | `--shadow-md` → `shadow-md` |
| `--ease-{name}` / `--duration-{name}` | `ease-{name}` / `duration-{name}` | for Reanimated-driven motion |

Components consume these classes only — never primitives from `01-primitives.md` directly, and never an arbitrary bracket value.

## 1. Color tokens

### Surface & content
| Token | Light → primitive | Dark → primitive | Class |
|---|---|---|---|
| `--color-background` | `#FFFFFF` | `gray-950` | `bg-background` |
| `--color-foreground` | `gray-900` | `gray-50` | `text-foreground` |
| `--color-card` | `gray-50` | `gray-900` | `bg-card` |
| `--color-card-foreground` | `gray-900` | `gray-50` | `text-card-foreground` |
| `--color-muted` | `#5e5e5e` | `#ababab` | `text-muted` — labels, meta, hints |
| `--color-subtle` | `#949494` *(toward canvas)* | `#808080` *(toward canvas)* | `text-subtle` — description under page/sheet/modal headings |
| `--color-border` | `gray-200` | `gray-800` | `border-border` |
| `--color-overlay` | `black/50` | `black/50` | `bg-overlay` |

**Progressive gray, white as the floor.** `background` is pure white — the base the app sits on, nothing lower. Every surface stacked above it steps one shade further into the gray ramp: `card` (`gray-50`) → `muted` (`gray-100`) → `border` (`gray-200`). This is the same ladder in `03-usage.md`'s elevation section, just expressed as literal color instead of shadow: depth reads through *both* an increasing gray step and an increasing shadow step together, never gray alone and never shadow alone. In dark mode the direction is the same relative to shadow but the absolute steps still run light-toward-dark background → progressively-lighter surfaces (`gray-950` → `gray-900` → `gray-800`), since a pure-black floor with no headroom to go darker would break the same ladder logic in reverse.

### Action — one accent drives everything
Borrowed from Astryx: their whole accent system generates from a single `color.accent` value rather than several hand-picked brand colors. Same rule here — `primary` is the *only* brand color you pick; everything else (subtle backgrounds, selected states) derives from it.

| Token | Light → primitive | Dark → primitive | Class |
|---|---|---|---|
| `--color-primary` | `brand-600` | `brand-500` | `bg-primary` / `text-primary` |
| `--color-primary-foreground` | `#FFFFFF` | `#FFFFFF` | `text-primary-foreground` |
| `--color-secondary` | `gray-100` | `gray-800` | `bg-secondary` |
| `--color-secondary-foreground` | `gray-900` | `gray-50` | `text-secondary-foreground` |
| `--color-accent-lighter` | `#eff6ff` | `#172554` | `bg-accent-lighter` — softest accent tint (notice cards, selected chip fill) |
| `--color-accent-light` | `#dbeafe` | `#22386d` | `bg-accent-light` — secondary accent buttons on accent-lighter surfaces |
| `--color-accent-moderate` | `#2563eb` | `#60a5fa` | `bg-accent-moderate`, `text-accent-moderate` — main brand blue |
| `--color-accent-dark` | `#1d4ed8` | `#3b82f6` | `bg-accent-dark`, `border-accent-dark` — emphasis, elevated button borders |
| `--color-accent-darker` | `#1e3a8a` | `#2563eb` | `bg-accent-darker`, `text-accent-darker` — deepest accent step |
| `--color-accent` | *(alias → moderate)* | *(alias → moderate)* | `bg-accent`, `text-accent`, `border-accent` |
| `--color-accent-foreground` | `#ffffff` | `#ffffff` | `text-accent-foreground` |
| `--color-accent-soft` | *(alias → lighter)* | *(alias → lighter)* | `bg-accent-soft` — backward-compatible alias |
| `--color-accent-muted` | *(alias → light)* | *(alias → light)* | `bg-accent-muted` — backward-compatible alias |

### Status
| Token pair | Light | Dark | Class |
|---|---|---|---|
| `success` / `success-foreground` | `success-500` / `#FFFFFF` | `success-500` / `success-900` | `bg-success text-success-foreground` |
| `warning` / `warning-foreground` | `warning-500` / `#1A1200` | `warning-500` / `warning-900` | `bg-warning text-warning-foreground` |
| `destructive` / `destructive-foreground` | `danger-500` / `#FFFFFF` | `danger-500` / `#FFFFFF` | `bg-destructive text-destructive-foreground` |
| `destructive` (inline) | `#ef4444` | `#f87171` | `text-destructive`, `border-destructive` — auth field errors |
| `success-soft` | `#e7f7ee` | `#173624` | `bg-success-soft` — veg selection fill, success tints |
| `destructive-soft` | `#fef2f2` | `#3f1515` | `bg-destructive-soft` — non-veg selection fill, soft error tints |
| `placeholder` | `foreground/20` | `foreground/20` | TextInput placeholder tint (via JS hook) |
| `info` / `info-foreground` | `info-500` / `#FFFFFF` | `info-500` / `info-900` | `bg-info text-info-foreground` |
| `success-subtle` / `success-subtle-foreground` | `success-50` / `success-700` | `success-900` / `success-50` | for banners, not solid fills |

### App surface ladder (auth + onboarding)

Progressive gray in light, progressive lift in dark. In light mode tune `--color-field` independently (typically one step darker than the sheet/canvas it sits on). In dark mode `--color-field` sits slightly below `--color-surface` — adjust in `global.css` if fields read too dark on the sheet.

| Token | Light | Dark | Class | Role |
|---|---|---|---|---|
| `--color-canvas` | `#ffffff` | `#000000` | `bg-canvas` | sheet fill when focused, app base |
| `--color-sheet` | `#ffffff` | `#101010` | `bg-sheet` | bottom sheet container |
| `--color-surface` | `#f6f6f6` | `#0d0d0d` | `bg-surface` | chips, secondary panels |
| `--color-field` | `#f6f6f6` *(tune in light)* | `#0c0c0c` *(slightly below surface)* | `bg-field` | **text field fill** — phone input, OTP cells |
| `--color-icon-surface` | `#eeeeee` | `#1c1c1c` | `bg-icon-surface` | circular icon buttons |
| `--color-ghost-on-field` | `#eaeaea` | `#262626` | `bg-ghost-on-field` | nested fills on gray `field`/`surface` cards (tags, ghost CTAs) |
| `--color-control-border` | `#cfcfcf` | `#303030` | `border-control-border` | stronger border for controls nested on gray surfaces |

**Light vs dark rule:** edit `--color-field` under `@variant light` when adjusting field contrast on white sheets. Dark mode keeps `--color-field` one step below `--color-surface` automatically — do not copy the light hex into dark.

## 2. Font-family tokens

```css
--font-heading: 'DMSerifText_400Regular';
--font-body:    'InclusiveSans_400Regular';          /* default body weight */
--font-body-medium: 'InclusiveSans_500Medium';       /* field input value text */
```

Classes: `font-heading`, `font-body`, `font-body-medium`. There is no `font-sans` in this system — `font-body` *is* the sans/default; leaving Tailwind's default `font-sans` undefined prevents anyone from accidentally shipping the OS system font.

**Body weight ladder** (each maps to a loaded static Inclusive Sans file):

| Class | Font file | Use |
|---|---|---|
| `font-body` | Inclusive Sans Regular | subtitles, labels, body copy |
| `font-body-medium` | Inclusive Sans Medium | **auth field values** — phone digits, OTP cells, prefix (`+91`) |
| `font-mono-semibold` | Inclusive Sans SemiBold | primary CTA labels |
| `font-mono-bold` | Inclusive Sans Bold | emphasis (rare) |

## 3. Font-size tokens (paired with line-height, Tailwind v4 style)

```css
/* heading sizes carry -1% tracking in the token — no tracking class needed */
--text-heading-sm: 18px;  --text-heading-sm--line-height: 25px;  --text-heading-sm--letter-spacing: -0.18px;
--text-heading-md: 22px;  --text-heading-md--line-height: 30px;  --text-heading-md--letter-spacing: -0.22px;
--text-heading-lg: 36px;  --text-heading-lg--line-height: 42px;
--text-heading-xl: 44px;  --text-heading-xl--line-height: 48px;  --text-heading-xl--letter-spacing: -0.44px;

--text-body-xs: 12px;  --text-body-xs--line-height: 18px;
--text-body-sm: 14px;  --text-body-sm--line-height: 20px;
--text-body-md: 16px;  --text-body-md--line-height: 24px;
--text-body-lg: 18px;  --text-body-lg--line-height: 26px;
```

Classes: `text-heading-sm` … `text-heading-xl`, `text-body-xs` … `text-body-lg` — each one class sets both size and leading in a single utility, same mechanic as Tailwind's built-in `text-lg`.

**Pairing rule:** a `font-heading` element always takes a `text-heading-*` size class; a `font-body` element always takes a `text-body-*` size class. Never cross them (`font-heading text-body-sm` is invalid — DM Serif Text at a body-scale size reads as a mistake, not a choice).

## 4. Radius tokens

```css
--radius-sm: 4px;
--radius-md: 8px;
--radius-lg: 12px;
--radius-xl: 16px;
--radius-2xl: 24px;
--radius-full: 9999px;

/* Auth sheet + onboarding CTA (from Figma Food-subs) */
--radius-sheet: 20px;           /* bottom sheet container */
--radius-field: 14px;           /* phone input, OTP cells */
--radius-button-outer: 18px;    /* primary CTA outer ring */
--radius-button-inner: 12px;    /* primary CTA fill */
```

Classes: `rounded-sm` … `rounded-full`, plus `rounded-sheet`, `rounded-field`, `rounded-button-outer`, `rounded-button-inner`.

## 4b. Auth / onboarding spacing tokens

```css
--spacing-sheet: 16px;          /* p-sheet, px-sheet */
--spacing-sheet-gap: 24px;      /* gap-sheet-gap */
--spacing-auth-block: 9px;      /* gap-auth-block — title/subtitle/field stack */
--spacing-field-inline: 10px;     /* gap-field-inline — +91 | input */
--spacing-otp: 8px;               /* gap-otp — OTP cell row */
--spacing-otp-section: 12px;      /* gap-otp-section — header + cells */
--spacing-button-wrap: 6px;       /* p-button-wrap — CTA double-border inset */
--spacing-field: 52px;            /* h-field, min-h-field */
--spacing-otp-cell: 50px;         /* h-otp-cell */
--spacing-icon-button: 36px;      /* size-icon-button — back/close circles */
```

## 4c. Letter-spacing tokens

```css
--tracking-body-sm: -0.28px;      /* tracking-body-sm — auth subtitles, links */
--tracking-body-md: -0.32px;      /* tracking-body-md — inputs, OTP digits */
```

## 5. Elevation / shadow tokens

```css
--shadow-xs: 0 1px 2px rgba(0,0,0,0.06);
--shadow-sm: 0 2px 4px rgba(0,0,0,0.08);
--shadow-md: 0 6px 12px rgba(0,0,0,0.12);
--shadow-lg: 0 12px 24px rgba(0,0,0,0.16);
```

Classes: `shadow-xs` … `shadow-lg`. Android needs `elevation` alongside `shadowColor`/`shadowOpacity`/`shadowRadius` — Uniwind maps the `shadow-*` utility to both automatically, but if you ever drop to a raw `StyleSheet`, set `elevation` yourself (roughly `1/2/6/12` for `xs/sm/md/lg`) or shadows silently vanish on Android.

**One elevation step per surface, always.** A card already carries `shadow-xs`; don't add another shadow class if that card sits inside a modal (`shadow-md`) — stacked shadows read as a rendering bug, not depth.

## 6. Icon size tokens

Sized on the existing spacing scale — no new namespace needed, just fixed `w-*`/`h-*` pairs to standardize instead of picking ad hoc per screen:

| Semantic size | Class pair | px |
|---|---|---|
| `icon-xs` | `w-4 h-4` | 16 |
| `icon-sm` | `w-5 h-5` | 20 |
| `icon-md` | `w-6 h-6` | 24 |
| `icon-lg` | `w-7 h-7` | 28 |
| `icon-xl` | `w-8 h-8` | 32 |

Icon *color* is never hardcoded — pass `className="text-foreground"` / `text-muted-foreground` / `text-primary` etc. to the icon component (lucide-react-native and most icon sets read `className`/`color` the same way text does) so icons stay theme-correct automatically.

## 7. Border width tokens

```css
--border-width-hairline: 1px; /* prefer StyleSheet.hairlineWidth at the component level on native */
--border-width-thick: 2px;
```

Class: `border` (hairline default), `border-2` (thick) — standard Tailwind width utilities, no custom class name needed.

## 8. Touch target token

```css
--size-touch-target-min: 44px;
```

Not a visual token — a minimum *hit slop*. See `03-usage.md` §11.

## 9. Avatar / image size tokens

| Semantic size | Class pair | px |
|---|---|---|
| `avatar-xs` | `w-6 h-6` | 24 |
| `avatar-sm` | `w-8 h-8` | 32 |
| `avatar-md` | `w-10 h-10` | 40 |
| `avatar-lg` | `w-14 h-14` | 56 |
| `avatar-xl` | `w-24 h-24` | 96 |

All avatars get `rounded-full`; product images/thumbnails use `rounded-lg` or `rounded-xl` per `04-radius tokens` above, never `rounded-full`.

## 10. Motion tokens

```css
--duration-fast: 150ms;
--duration-base: 250ms;
--duration-slow: 400ms;
--ease-standard: cubic-bezier(0.2, 0, 0, 1);
```

## 11. Rules

1. **One accent, derived states — never a hand-picked second brand color.** Need emphasis beyond `primary`? Reach for a status token, not a new hex.
2. **`font-heading` + `text-heading-*` and `font-body` + `text-body-*` are pairs, not mix-and-match.**
3. **Every background token that can hold text needs a `-foreground` pair.** Don't compute contrast ad hoc in a component.
4. **Status hues stay locked** across light/dark — only surface lightness changes, never the hue family.
5. If you need a new token, ask: does Tailwind already have a namespace for this (`--color-`, `--font-`, `--text-`, `--radius-`, `--shadow-`, `--ease-`/`--duration-`)? If yes, extend that namespace. If no, it probably doesn't belong in `global.css` as a token at all.
