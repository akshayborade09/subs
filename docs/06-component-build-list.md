# Component Build List — RN Scope

Filtered from `05-component-inventory.md`: only components worth building for this app. Excludes are dropped entirely (no hover/right-click/keyboard/resizable-pane patterns — see that file if you want the reasoning). This is the actual scope list.

## Include — build as-is

| Component | Note |
|---|---|
| AspectRatio | Image/video containers, feed cards |
| Avatar | Already tokenized — `02-tokens.md` §9 |
| Badge | Needs token entry (gap — see `05-component-inventory.md`) |
| Banner | Already covered — `03-usage.md` §8 |
| Button | Already covered — `03-usage.md` §3 |
| Calendar | Date-picker screens |
| Card | Already covered — `03-usage.md` §4 |
| Carousel | Onboarding, promo banners, image galleries |
| Checkbox | |
| CircularProgress | Upload/sync progress rings |
| Collapsible | FAQs, expandable sections |
| DateInput | |
| Dialog | Modal — `shadow-md`, `z-modal` |
| Divider | Covered via `border-border` |
| EmptyState | Already covered — `03-usage.md` §13 |
| Field | Label + input + helper/error text wrapper |
| Heading | Covered via `font-heading` classes |
| Icon | Already covered — `02-tokens.md` §6 |
| Item | Generic list-row primitive — needs formalizing (gap) |
| Layout | Structural wrapper (Stack/Row) |
| Lightbox | Tap-to-zoom image viewer |
| List | |
| MetadataList | Key-value rows — stats, order/transaction detail |
| Navigation | Tab bar + header — two distinct RN components, not one |
| NumberInput | Stepper controls |
| Overlay | Scrim — `--color-overlay`, base for Dialog/ActionSheet |
| ProgressBar | |
| Radio | |
| SegmentedControl | iOS-native pattern, high value |
| Selector | Generic picker/selection surface |
| Skeleton | Already covered — `03-usage.md` §13 |
| Slider | |
| Spinner | |
| StatusDot | Needs token entry (gap) |
| Switch | |
| Tabs | In-page content switching, distinct from tab bar |
| Text | Covered via `font-body` classes |
| TextArea | |
| TextInput | Already covered — `03-usage.md` §5 |
| Thumbnail | Covered via avatar/image sizing tokens |
| TimeInput | |
| Timestamp | Needs formatting/style rule (gap) |
| Toast | Already covered — `03-usage.md` §8 |

**41 components.**

## Adapt — real need, different RN pattern

| Component | Build instead as |
|---|---|
| Blockquote | Only if long-form/article content exists in-app |
| Chat | Composed from List + Field + Avatar, not a monolithic component |
| ContextMenu | **ActionSheet** (long-press trigger) |
| DropdownMenu | **ActionSheet** (bottom) or native **Picker** |
| FileInput | `expo-document-picker`/`expo-image-picker` trigger button |
| Link | `Pressable` styled `text-primary` — a Button variant, not a separate component |
| Markdown | Only if rendering markdown content (chatbot output, CMS copy) |
| MoreMenu | **ActionSheet** |
| OverflowList | Build it ("+3 more" chip pattern), just no hover-to-reveal |
| Pagination | Rare — mobile defaults to infinite scroll; only for a genuine paginated table |
| Popover | **BottomSheet** preferred; true popovers only on tablet/large-screen layouts |
| PowerSearch | Only if a genuine power-search surface is needed; else standard search field |
| Table | Usually decomposes into List + Item + detail screen; keep real Table for tablet/web-shared code only |
| Token | Build as a **Badge** variant (removable tag/chip), not a separate primitive |
| Toolbar | This is the header's action-icon row — covered by Navigation, not separate |
| Tooltip | Tap-to-reveal via info icon + Popover/BottomSheet, used sparingly |

**16 components/patterns.**

## Not on Astryx's list but required for RN

- **ActionSheet** — the actual RN-native replacement for four Adapt entries above (ContextMenu, DropdownMenu, MoreMenu, and often Popover/Tooltip). Doesn't exist as its own entry on the web-oriented list but is arguably the highest-priority build here.

---

**Total build scope: 41 Include + 16 Adapt + 1 ActionSheet = 58 components/patterns**, down from the ~69 on the original list.
