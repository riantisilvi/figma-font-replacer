# Font Replacer: Component Spec

## 1. Overview

The plugin window is 440 x 640 px. It has three regions:

| Region | Content | Behavior |
|---|---|---|
| Header | Scope control, Scan button, "Include hidden layers" | Fixed at the top |
| Body | Summary bar, one Family group for each source family | Scrolls. The summary bar is sticky. |
| Footer | Preset bar, options, Replace action, or the Result report | Fixed at the bottom. Shows only after a scan that found fonts. |

All colors use Figma theme variables (`--figma-color-*`) through Tailwind tokens (`bg`, `fg`, `border`). The plugin follows the Figma light and dark theme. Components follow the shadcn/ui pattern: a variant map, a size map, and a `cn()` class helper.

## 2. Tokens

| Token | Tailwind class | Figma variable |
|---|---|---|
| Surface | `bg-bg` | `--figma-color-bg` |
| Surface, secondary | `bg-bg-secondary` | `--figma-color-bg-secondary` |
| Hover | `bg-bg-hover` | `--figma-color-bg-hover` |
| Brand | `bg-bg-brand` | `--figma-color-bg-brand` |
| Selected option | `bg-bg-selected` | `--figma-color-bg-selected` |
| Danger fill | `bg-bg-danger` | `--figma-color-bg-danger-tertiary` |
| Text | `text-fg` | `--figma-color-text` |
| Text, secondary | `text-fg-secondary` | `--figma-color-text-secondary` |
| Text, danger | `text-fg-danger` | `--figma-color-text-danger` |
| Border | `border-border` | `--figma-color-border` |
| Focus ring | `:focus-visible` outline | `--figma-color-border-selected` |

Type scale: `xs` 11/16, `sm` 12/16, `base` 13/20. Counts use `tabular-nums`.

## 3. Screen states

| State | Trigger | Body | Footer |
|---|---|---|---|
| Loading | Plugin opens | Spinner, "Loading available fonts" | Hidden |
| Empty | Fonts loaded, no scan yet | Title and one line of help | Hidden |
| Scanning | Scan button | Progress bar (after the first 150 layers) or spinner | Hidden |
| Ready | Scan result | Summary bar and Family groups | Preset bar, options, Replace |
| No fonts | Scan found no text, or the filter hides all rows | "No fonts found" with the reason | Hidden when the scan found no fonts |
| Stale | Scope changed after a scan | List stays. Warning under the header. | Replace is disabled |
| Replacing | Replace button | List stays, controls disabled | Progress bar, Replace shows a spinner |
| Done | Replace result | List updates after an automatic rescan | Result report |
| Error | Main thread error | Alert with the message and "Try again" | Unchanged |

## 4. Components

### 4.1 Button

| Prop | Type | Default | Note |
|---|---|---|---|
| `variant` | `"primary" \| "secondary" \| "ghost" \| "danger"` | `"secondary"` | |
| `size` | `"sm" \| "md"` | `"md"` | `sm` 24 px, `md` 32 px |
| `loading` | `boolean` | `false` | Shows a spinner, disables the button, sets `aria-busy` |
| `disabled` | `boolean` | `false` | |
| ...button attributes | | | Forwards a ref |

States: default, hover, focus-visible, disabled, loading.

Accessibility: native `<button type="button">`. An icon-only use needs `aria-label`.

### 4.2 SegmentedControl (scope)

| Prop | Type | Note |
|---|---|---|
| `label` | `string` | Accessible name of the group |
| `value` | `T extends string` | Selected value |
| `options` | `{ value, label, disabled? }[]` | "Selection" shows the selection count |
| `disabled` | `boolean` | Disables all options |
| `onChange` | `(value: T) => void` | |

States: selected, unselected, hover, focus-visible, disabled.

Accessibility: `role="radiogroup"` with `role="radio"` items and `aria-checked`. Roving tab index: only the selected item is in the tab order. Arrow keys move and select.

### 4.3 FontCombobox (replacement family)

| Prop | Type | Note |
|---|---|---|
| `label` | `string` | For example "Replacement family for Inter" |
| `families` | `string[]` | All installed families, sorted |
| `value` | `string \| null` | Selected family. `null` means no change. |
| `placeholder` | `string` | Default "Select font". Family groups use "Keep current font". |
| `disabled` | `boolean` | |
| `onChange` | `(family: string \| null) => void` | `null` when the user clears it |

States: closed empty, closed with value, open with results, open with no results ("No fonts match"), active option, disabled.

Variants: none. A value shows in medium weight.

Behavior:
- Search is case-insensitive. Prefix matches show first. The list shows a maximum of 80 results.
- The clear button sets the value to `null`.
- A pointer down outside the component closes the list.

Accessibility: WAI-ARIA combobox pattern with list autocomplete. `role="combobox"`, `aria-expanded`, `aria-controls`, `aria-activedescendant`. Options use `role="option"` and `aria-selected`. Keys: Down opens or moves, Up moves, Home and End, Enter selects, Escape closes, Tab closes. The active option scrolls into view.

### 4.4 FamilyGroup

| Prop | Type | Note |
|---|---|---|
| `family` | `string` | Source family |
| `rows` | `StyleRowModel[]` | One row for each source style |
| `families` | `string[]` | Passed to FontCombobox |
| `targetFamily` | `string \| null` | Replacement family |
| `targetStyles` | `string[]` | Styles of the replacement family, sorted by width, weight, italic |
| `disabled` | `boolean` | True while busy |
| `onTargetFamily` | `(source, target \| null) => void` | Clears the style overrides of this family |
| `onTargetStyle` | `(usage, style \| null) => void` | `null` resets to auto-match |
| `onLocate` | `(nodeIds) => void` | Selects layers on the canvas |

`StyleRowModel`: `{ usage: FontUsage; target: Font \| null; overridden: boolean }`.

Row anatomy: source style, layer count button, arrow, style select, reset icon.

States:

| State | Visual |
|---|---|
| Unmapped | Style select disabled, "No change" |
| Auto-matched | Style select shows the nearest style, regular weight |
| Overridden | Style select in medium weight, reset icon visible |
| Unchanged | Target equals source, text in tertiary color. Not sent to Replace. |
| Missing source | Style name in danger color, "Missing" badge on the family header |

Accessibility: each group is a `<section>` with `aria-labelledby` on the family heading. The count button has the label "Select N layers that use Family Style". The select has the label "Replacement style for Family Style". A missing style has visually hidden text "(missing)", so the state does not rely on color only.

### 4.5 PresetBar

| Prop | Type | Note |
|---|---|---|
| `presets` | `Preset[]` | From `figma.clientStorage` |
| `canSave` | `boolean` | True when at least one family has a target |
| `disabled` | `boolean` | |
| `onApply` | `(preset) => void` | Applies only to families in the current scan |
| `onSave` | `(name) => void` | Same name replaces the old preset |
| `onDelete` | `(id) => void` | |

States: no presets, preset list, preset selected (shows Apply and Delete), save form (name field, Save, Cancel).

Accessibility: native `<select>` with the label "Preset". The save form submits with Enter. Escape cancels.

### 4.6 Checkbox

| Prop | Type |
|---|---|
| `id` | `string` |
| `label` | `string` |
| `description` | `string` (optional, linked with `aria-describedby`) |
| `checked` | `boolean` |
| `disabled` | `boolean` |
| `onChange` | `(checked: boolean) => void` |

Accessibility: native checkbox with a `<label for>`.

### 4.7 ProgressBar

| Prop | Type |
|---|---|
| `label` | `string` |
| `done` | `number` |
| `total` | `number` |

Accessibility: `role="progressbar"` with `aria-valuenow` (percent), `aria-valuemin`, `aria-valuemax`, `aria-label`.

### 4.8 ResultReport

| Prop | Type | Note |
|---|---|---|
| `result` | `ReplaceResult` | Counts, skipped layers, failed items, duration |
| `onLocate` | `(nodeIds) => void` | "Select" for each skipped group |
| `onDismiss` | `() => void` | "Done" goes back to the Ready footer |

Variants: success (one or more changes, check icon), no change (warning icon).

Skip reasons: Locked layer, Hidden layer, Uses a library text style, Replacement font cannot load, Not editable.

Accessibility: `role="status"` with `aria-live="polite"`, so screen readers announce the result.

### 4.9 Badge

| Prop | Type |
|---|---|
| `variant` | `"danger" \| "warning" \| "success" \| "neutral"` |
| `children` | `ReactNode` |

## 5. Interaction rules

1. A replace run uses the scope of the last scan. If the scope control changes, Replace is disabled until the next scan.
2. A change of the replacement family clears the style overrides of that family.
3. After a replace run with changes, the plugin scans again. The result report stays open.
4. "Reset" clears all family targets and overrides.
5. All motion is 150 ms or less and stops with `prefers-reduced-motion: reduce`.

## 6. Figma build notes

If you rebuild this UI as a Figma component set:

| Component | Variant properties |
|---|---|
| Button | `variant` (primary, secondary, ghost, danger), `size` (sm, md), `state` (default, hover, focus, disabled, loading) |
| Style row | `state` (unmapped, auto, overridden, unchanged), `missing` (true, false) |
| Family group | `missing` (true, false), `mapped` (true, false) |
| Result report | `outcome` (changed, no change), `issues` (true, false) |

Bind fills and strokes to variables that mirror the token table in section 2.
