# Design System — Overview

Design system for a React Native app styled with **Uniwind** (Tailwind v4 bindings for React Native, drop-in NativeWind replacement). This folder is written to be dropped into `.cursor/rules/` so Cursor can use each file as a scoped "skill" when generating or editing UI code.

## File map

| File | Purpose | When Cursor should read it |
|---|---|---|
| `01-primitives.md` | Raw, meaningless values — color ramps, spacing scale, radius, type scale, shadow, opacity, z-index | Only when defining or changing `global.css` |
| `02-tokens.md` | Semantic tokens — what a primitive *means* (background, foreground, primary, destructive...) | Whenever styling any component |
| `03-usage.md` | Component-level rules — which token/class to reach for, patterns, anti-patterns | Whenever writing or reviewing JSX/className |
| `global.css` | The actual Uniwind theme implementation of `02-tokens.md` | Loaded by the app at runtime — not edited casually |

## Core principle

**Primitives have no opinion. Tokens have an opinion. Components only ever consume tokens.**

```
primitive (gray-950)  →  token (--color-background, dark mode)  →  usage (bg-background)
```

A component file should never contain a raw primitive class like `bg-gray-950` or `text-[#FEF3C7]`. If you find yourself typing a raw hex or an un-mapped Tailwind scale step directly in a component, stop — either the token you need doesn't exist yet (add it to `02-tokens.md` + `global.css`), or you're bypassing the system.

## Theming model

Uniwind (Tailwind v4) reads theme variables from `global.css` via `@theme` and `@layer theme { :root { ... } @variant dark { ... } }`. Light values live at `:root`, dark overrides live inside `@variant dark`. Components use the semantic class (`bg-background`, `text-foreground`, `border-border`) and never need a `dark:` prefix for token-driven properties — the variable itself flips.

`dark:` prefixes are still used for one-off cases that aren't tokenized (rare, and should be justified in a code comment).

## Naming convention

- Primitives: `{family}-{step}` → `gray-50` … `gray-950`, `space-1` … `space-16`
- Tokens: `{role}` or `{role}-{state}` → `background`, `foreground`, `primary`, `primary-foreground`, `border`, `destructive`
- Component variants layer on top of tokens, never on top of primitives directly.

## Reference

The token *shape* (single accent driving derived states, role-paired font/size tokens, a graduated customization path) takes a cue from [Astryx](https://astryx.atmeta.com), Meta's open-source design system. The *naming*, however, stays 100% Tailwind-native — every token sits under a namespace (`--color-`, `--font-`, `--text-`, `--radius-`) that Tailwind v4 already knows how to turn into a utility class, so nothing here needs a plugin or a second naming system layered on top of classes you already know.

## Fonts

- `font-heading` → Abril Fatface (display serif, headings only, single weight)
- `font-body` → Geist Mono (everything else — labels, buttons, inputs, body copy)

Neither is a system font; both must be registered via `expo-font` before first paint. See `03-usage.md` §0.

## How to extend this system

1. Need a new raw value (e.g. a new color ramp)? → add to `01-primitives.md`.
2. Need a new meaning (e.g. a "success" state)? → add to `02-tokens.md`, wire it into `global.css` for both light and dark.
3. Need a new usage pattern (e.g. how disabled buttons should look)? → add to `03-usage.md`.

Never skip a layer. A token that isn't backed by a primitive, or a component class that isn't backed by a token, is technical debt on day one.

## Cursor rules

Progressive docs above are enforced via `.cursor/rules/`:

| Rule file | Scope | Reads |
|---|---|---|
| `design-system-core.mdc` | **Always apply** | Index + hard rules; opens `02-tokens` / `03-usage` on demand |
| `design-system-theme.mdc` | `global.css` | `01-primitives.md`, `02-tokens.md` |
| `design-system-ui.mdc` | `**/*.{tsx,jsx}` | `03-usage.md` |

Keep rules short; keep full detail in `docs/`. When tokens change, update `docs/02-tokens.md`, `global.css`, and `src/themeColors.ts` together.
