# Font Replacer

A Figma plugin that finds every font in a selection, a page, or the full file, and replaces fonts in one run. It finds missing fonts, matches styles by weight and italic, updates local text styles, and saves mappings as presets.

## Features

| Feature | Detail |
|---|---|
| Scan | Lists each font (family and style) with its layer count. Scope: Selection, Page, or All pages. |
| Missing fonts | Fonts that are not installed show at the top with a "Missing" badge. Use "Missing only" to filter. |
| Map | Select one replacement family for each source family. Each style gets the nearest style of the new family. |
| Style override | Change the replacement style of a row by hand. Select the reset icon to go back to auto-match. |
| Mixed text | Replaces per character range. A layer with Inter Regular and Inter Bold keeps both weights. |
| Text styles | "Update text styles" changes local text styles first. Ranges that use those styles follow the style and stay linked. |
| Safety | Skips locked layers (option), hidden layers (option), and ranges that use a library text style. The report lists each skipped group. |
| Locate | Select the layer count of a row to select those layers on the canvas. |
| Presets | Save the current mapping (for example "Inter to Geist") and apply it in other files. Presets are stored on your computer with `figma.clientStorage`. |
| Undo | One replace run is one undo step. |

## Install for development

1. Install Node.js 18 or later.
2. Install the dependencies and build the plugin:

   ```bash
   npm install
   npm run build
   ```

3. In the Figma desktop app, go to Plugins > Development > Import plugin from manifest.
4. Select `manifest.json` in this folder.
5. Run the plugin from Plugins > Development > Font Replacer.

To rebuild on each save, run `npm run watch`.

## Use

1. Select a scope: Selection, Page, or All pages.
2. Select "Scan fonts".
3. For each family, type the name of the replacement family in "Replace with" and select it.
4. Check the replacement style of each row. Change a style if necessary.
5. Set the options: "Skip locked layers" and "Update text styles".
6. Select "Replace fonts".
7. Read the result report. Select "Select" on a skipped group to see those layers.

## Behavior and limits

| Case | What the plugin does |
|---|---|
| Source font is missing | The plugin replaces it. Figma allows a font change on a layer with a missing font. |
| Replacement font cannot load | The plugin does not change the range and reports it as skipped. |
| Range uses a library text style | The plugin does not change the range, because a direct change detaches the style. Update the font in the library file. |
| Range uses a local text style and "Update text styles" is off | The plugin changes the range. This detaches the range from the style. |
| Text inside an instance | The plugin changes it as an override. The main component does not change. |
| All pages scope | The plugin loads all pages first. In large files this can take some seconds. |
| Shared fonts and team fonts | The plugin lists only the fonts that `figma.listAvailableFontsAsync()` returns on this computer. |

## Scripts

| Command | Result |
|---|---|
| `npm run build` | Builds `dist/code.js` and `dist/ui.html` |
| `npm run watch` | Builds again when a file changes |
| `npm run typecheck` | Runs `tsc --noEmit` |
| `npm run lint` | Runs ESLint |
| `npm run test` | Runs the Vitest unit tests |
| `npm run check` | Runs all of the above |

## Project structure

```
manifest.json            Plugin manifest (dynamic-page access, no network)
build.mjs                esbuild and Tailwind build, inlines the UI into one HTML file
src/code.ts              Main thread: scan, replace, text styles, presets, canvas selection
src/shared/types.ts      Message contract between the UI and the main thread
src/shared/fontMatch.ts  Style parsing, style matching, font search
src/shared/core.ts       Scan and replace logic on a minimal node interface (unit tested)
src/shared/mapping.ts    Family targets and overrides to mappings, presets
src/ui/                  React and Tailwind UI (Figma theme colors)
tests/                   Vitest unit tests
docs/component-spec.md   Component spec: props, states, variants, accessibility
```

## Publish

Before you publish to the Figma Community, change `id` in `manifest.json` to the ID that Figma gives you when you create the plugin in Plugins > Development > New plugin.
