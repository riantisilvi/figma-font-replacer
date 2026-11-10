// Plugin main thread. Runs in the Figma sandbox. Talks to the UI with postMessage.
import { isHiddenChain, isInsideRemoteComponent, replaceInNode, UsageCollector } from "./shared/core";
import type { TextLike } from "./shared/core";
import { fontKey } from "./shared/fontMatch";
import type {
  CodeToUi,
  FailedLayer,
  Font,
  Mapping,
  Preset,
  ReplaceOptions,
  ReplaceResult,
  Scope,
  SkippedLayer,
  UiToCode,
} from "./shared/types";

const PRESETS_KEY = "font-replacer.presets.v1";
const CHUNK = 150;

figma.showUI(__html__, { width: 440, height: 640, themeColors: true, title: "Font Replacer" });

function post(message: CodeToUi): void {
  figma.ui.postMessage(message);
}

const yieldToFigma = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

// ---------- Fonts ----------

let availableFonts: Font[] = [];
let availableKeys = new Set<string>();

async function loadAvailableFonts(): Promise<void> {
  const list = await figma.listAvailableFontsAsync();
  availableFonts = list.map((f) => ({ family: f.fontName.family, style: f.fontName.style }));
  availableKeys = new Set(availableFonts.map(fontKey));
}

const fontLoadCache = new Map<string, Promise<boolean>>();

function loadFont(font: Font): Promise<boolean> {
  const key = fontKey(font);
  let pending = fontLoadCache.get(key);
  if (!pending) {
    pending = figma.loadFontAsync(font).then(
      () => true,
      () => false,
    );
    fontLoadCache.set(key, pending);
  }
  return pending;
}

// ---------- Node collection ----------

async function collectTextNodes(scope: Scope, includeHidden: boolean): Promise<TextNode[]> {
  figma.skipInvisibleInstanceChildren = !includeHidden;
  let nodes: TextNode[] = [];

  if (scope === "selection") {
    const seen = new Set<string>();
    for (const node of figma.currentPage.selection) {
      const found: TextNode[] =
        node.type === "TEXT"
          ? [node]
          : "findAllWithCriteria" in node
            ? node.findAllWithCriteria({ types: ["TEXT"] })
            : [];
      for (const text of found) {
        if (!seen.has(text.id)) {
          seen.add(text.id);
          nodes.push(text);
        }
      }
    }
  } else if (scope === "page") {
    nodes = figma.currentPage.findAllWithCriteria({ types: ["TEXT"] });
  } else {
    await figma.loadAllPagesAsync();
    nodes = figma.root.findAllWithCriteria({ types: ["TEXT"] });
  }

  if (!includeHidden) nodes = nodes.filter((n) => !isHiddenChain(n));
  return nodes;
}

// ---------- Scan ----------

async function scan(scope: Scope, includeHidden: boolean): Promise<void> {
  if (scope === "selection" && figma.currentPage.selection.length === 0) {
    post({ type: "scan-result", scope, usages: [], textLayerCount: 0 });
    return;
  }

  const nodes = await collectTextNodes(scope, includeHidden);
  const collector = new UsageCollector(availableKeys);

  for (let i = 0; i < nodes.length; i++) {
    collector.addNode(nodes[i] as unknown as TextLike);
    if ((i + 1) % CHUNK === 0) {
      post({ type: "progress", phase: "scan", done: i + 1, total: nodes.length });
      await yieldToFigma();
    }
  }

  const styles = await figma.getLocalTextStylesAsync();
  for (const style of styles) collector.addStyle(style.fontName);

  post({ type: "scan-result", scope, usages: collector.result(), textLayerCount: nodes.length });
}

// ---------- Replace ----------

async function replace(scope: Scope, mappings: Mapping[], options: ReplaceOptions): Promise<void> {
  const started = Date.now();
  const mapping = new Map<string, Font>();
  for (const m of mappings) {
    if (m.from.family !== m.to.family || m.from.style !== m.to.style) {
      mapping.set(fontKey(m.from), m.to);
    }
  }

  const result: ReplaceResult = {
    layersChanged: 0,
    rangesChanged: 0,
    stylesUpdated: 0,
    skipped: [],
    failed: [],
    durationMs: 0,
  };

  if (mapping.size === 0) {
    result.durationMs = Date.now() - started;
    post({ type: "replace-result", result });
    return;
  }

  const localStyles = await figma.getLocalTextStylesAsync();
  const localStyleIds = new Set(localStyles.map((s) => s.id));
  const updatedStyleIds = new Set<string>();

  if (options.updateTextStyles) {
    for (const style of localStyles) {
      const target = mapping.get(fontKey(style.fontName));
      if (!target) continue;
      if (await loadFont(target)) {
        await loadFont(style.fontName);
        style.fontName = target;
        updatedStyleIds.add(style.id);
        result.stylesUpdated += 1;
      } else {
        result.failed.push({ nodeId: style.id, name: `Text style: ${style.name}`, error: "Target font cannot load" });
      }
    }
  }

  const nodes = await collectTextNodes(scope, options.includeHidden);
  const skipped: SkippedLayer[] = [];
  const failed: FailedLayer[] = [];

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    try {
      if (isInsideRemoteComponent(node as unknown as TextLike)) {
        skipped.push({ nodeId: node.id, name: node.name, reason: "not-editable" });
      } else {
        const outcome = await replaceInNode(node as unknown as TextLike, {
          mapping,
          options,
          loadFont,
          localStyleIds,
          updatedStyleIds,
        });
        if (outcome.ranges > 0) {
          result.layersChanged += 1;
          result.rangesChanged += outcome.ranges;
        } else if (outcome.skip) {
          skipped.push({ nodeId: node.id, name: node.name, reason: outcome.skip });
        }
      }
    } catch (error) {
      failed.push({ nodeId: node.id, name: node.name, error: error instanceof Error ? error.message : String(error) });
    }

    if ((i + 1) % CHUNK === 0) {
      post({ type: "progress", phase: "replace", done: i + 1, total: nodes.length });
      await yieldToFigma();
    }
  }

  result.skipped = skipped;
  result.failed = result.failed.concat(failed);
  result.durationMs = Date.now() - started;
  figma.commitUndo();

  const changed = result.layersChanged + result.stylesUpdated;
  figma.notify(
    changed > 0
      ? `Replaced fonts in ${result.layersChanged} layers and ${result.stylesUpdated} styles`
      : "No layers changed",
  );
  post({ type: "replace-result", result });
}

// ---------- Select on canvas ----------

async function selectNodes(nodeIds: string[]): Promise<void> {
  const byPage = new Map<string, { page: PageNode; nodes: SceneNode[] }>();
  for (const id of nodeIds) {
    const node = await figma.getNodeByIdAsync(id);
    if (!node || !("visible" in node)) continue;
    let page: BaseNode | null = node.parent;
    while (page && page.type !== "PAGE") page = page.parent;
    if (!page) continue;
    const entry = byPage.get(page.id) ?? { page: page as PageNode, nodes: [] };
    entry.nodes.push(node as SceneNode);
    byPage.set(page.id, entry);
  }
  if (byPage.size === 0) {
    figma.notify("These layers no longer exist. Scan again.");
    return;
  }

  const target = byPage.get(figma.currentPage.id) ?? [...byPage.values()][0];
  if (target.page.id !== figma.currentPage.id) await figma.setCurrentPageAsync(target.page);
  figma.currentPage.selection = target.nodes;
  figma.viewport.scrollAndZoomIntoView(target.nodes);

  const otherPages = byPage.size - 1;
  figma.notify(
    `Selected ${target.nodes.length} layers` + (otherPages > 0 ? ` (${otherPages} other pages also use this font)` : ""),
  );
}

// ---------- Presets ----------

async function readPresets(): Promise<Preset[]> {
  const stored = (await figma.clientStorage.getAsync(PRESETS_KEY)) as Preset[] | undefined;
  return Array.isArray(stored) ? stored : [];
}

async function writePresets(presets: Preset[]): Promise<void> {
  await figma.clientStorage.setAsync(PRESETS_KEY, presets);
  post({ type: "presets", presets });
}

// ---------- Message router ----------

const postSelection = () => post({ type: "selection", count: figma.currentPage.selection.length });
figma.on("selectionchange", postSelection);
figma.on("currentpagechange", postSelection);

figma.ui.onmessage = async (message: UiToCode) => {
  try {
    switch (message.type) {
      case "init": {
        await loadAvailableFonts();
        post({ type: "fonts", fonts: availableFonts });
        post({ type: "presets", presets: await readPresets() });
        post({ type: "selection", count: figma.currentPage.selection.length });
        break;
      }
      case "scan":
        await scan(message.scope, message.includeHidden);
        break;
      case "replace":
        await replace(message.scope, message.mappings, message.options);
        break;
      case "select-nodes":
        await selectNodes(message.nodeIds);
        break;
      case "save-preset": {
        const presets = await readPresets();
        const index = presets.findIndex((p) => p.id === message.preset.id || p.name === message.preset.name);
        if (index >= 0) presets[index] = { ...message.preset, id: presets[index].id };
        else presets.push(message.preset);
        await writePresets(presets);
        figma.notify(`Preset "${message.preset.name}" saved`);
        break;
      }
      case "delete-preset":
        await writePresets((await readPresets()).filter((p) => p.id !== message.id));
        break;
      case "notify":
        figma.notify(message.message, { error: message.error ?? false });
        break;
    }
  } catch (error) {
    post({ type: "error", message: error instanceof Error ? error.message : String(error) });
  }
};
