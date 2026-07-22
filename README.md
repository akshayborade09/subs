# Astryx Native starter

An iOS-first Expo app that translates Astryx's visual approach into native UI: semantic color tokens, calm surfaces, compact labels, rounded controls, accessible touch targets, and complete light/dark themes. Styling uses Uniwind + Tailwind CSS v4 class names; motion uses React Native Reanimated. Astryx web components are intentionally not installed.

## Run

```sh
pnpm install
pnpm ios
```

Use `pnpm android` for Android or `pnpm web` for the browser. `pnpm start` opens Expo's interactive launcher for all platforms.

The app follows the iPhone appearance initially. Use the moon/sun control to inspect both themes at any time.

## Structure

- `global.css` — Astryx-inspired semantic tokens for both themes
- `src/components.tsx` — native Uniwind primitives with Reanimated feedback
- `App.tsx` — sample iOS home screen and theme preview
