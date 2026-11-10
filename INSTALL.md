# Install Font Replacer in Figma

You do not need the command line for these steps. You need the Figma desktop app for macOS or Windows. The plugin does not work in Figma in the browser.

## Install (one time)

1. Download the plugin: https://github.com/riantisilvi/figma-font-replacer/releases/latest/download/font-replacer.zip
2. Double-click `font-replacer.zip` to unzip it.
3. Move the `font-replacer` folder to a location where it can stay, for example your Documents folder. Do not delete or move the folder after step 6.
4. Open the Figma desktop app and open any design file.
5. Go to Menu > Plugins > Development > Import plugin from manifest.
6. Select `manifest.json` in the `font-replacer` folder.

## Use

1. Go to Menu > Plugins > Development > Font Replacer.
2. Select a scope: Selection, Page, or All pages.
3. Select "Scan fonts".
4. For each font family, select a family in "Replace with".
5. Check the style of each row. Change a style if necessary.
6. Select "Replace fonts".

To undo a replace, press Cmd+Z (Ctrl+Z on Windows) in Figma.

## Update to a new version

1. Download the zip again from the link in step 1.
2. Unzip it.
3. Replace the old `font-replacer` folder with the new one, at the same location.

You do not need to import the plugin again. Figma uses the new version the next time you run the plugin.

## Problems

| Problem | Fix |
|---|---|
| "Development" is not in the Plugins menu | Use the Figma desktop app. The browser version does not have this menu. |
| The plugin does not start after you moved the folder | Import `manifest.json` again from the new location. |
| Some layers are skipped | The result report shows the reason. Library text styles must be changed in the library file. |
