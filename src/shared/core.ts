// Scan and replace logic over a minimal node interface.
// code.ts passes real Figma nodes. Tests pass mock nodes.
import { fontKey } from "./fontMatch";
import type { Font, FontUsage, ReplaceOptions, SkipReason } from "./types";

export interface Segment {
  start: number;
  end: number;
  fontName: Font;
  textStyleId: string;
}

export interface ParentLike {
  type: string;
  locked?: boolean;
  visible?: boolean;
  parent: ParentLike | null;
}

export interface TextLike extends ParentLike {
  id: string;
  name: string;
  getStyledTextSegments(fields: Array<"fontName" | "textStyleId">): Segment[];
  setRangeFontName(start: number, end: number, font: Font): void;
}

/** True when the node or any ancestor below the page is locked. */
export function isLockedChain(node: ParentLike): boolean {
  let current: ParentLike | null = node;
  while (current && current.type !== "PAGE" && current.type !== "DOCUMENT") {
    if (current.locked) return true;
    current = current.parent;
  }
  return false;
}

/** True when the node or any ancestor below the page is hidden. */
export function isHiddenChain(node: ParentLike): boolean {
  let current: ParentLike | null = node;
  while (current && current.type !== "PAGE" && current.type !== "DOCUMENT") {
    if (current.visible === false) return true;
    current = current.parent;
  }
  return false;
}

/** Text layers inside an instance cannot change unless the override is allowed. Text in a remote main component never changes. */
export function isInsideRemoteComponent(node: ParentLike & { remote?: boolean }): boolean {
  let current: (ParentLike & { remote?: boolean }) | null = node;
  while (current) {
    if ((current.type === "COMPONENT" || current.type === "COMPONENT_SET") && current.remote) return true;
    current = current.parent as (ParentLike & { remote?: boolean }) | null;
  }
  return false;
}

export class UsageCollector {
  private usages = new Map<string, FontUsage>();
  private nodeSeen = new Map<string, Set<string>>();

  constructor(private readonly availableKeys: Set<string>) {}

  addNode(node: Pick<TextLike, "id" | "getStyledTextSegments">): void {
    const segments = node.getStyledTextSegments(["fontName"]);
    for (const segment of segments) {
      const usage = this.ensure(segment.fontName);
      usage.rangeCount += 1;
      const seen = this.nodeSeen.get(usage.key)!;
      if (!seen.has(node.id)) {
        seen.add(node.id);
        usage.layerCount += 1;
        usage.nodeIds.push(node.id);
      }
    }
  }

  addStyle(font: Font): void {
    this.ensure(font).styleCount += 1;
  }

  result(): FontUsage[] {
    return [...this.usages.values()].sort(
      (a, b) =>
        Number(b.missing) - Number(a.missing) ||
        a.font.family.localeCompare(b.font.family) ||
        b.layerCount - a.layerCount ||
        a.font.style.localeCompare(b.font.style),
    );
  }

  private ensure(font: Font): FontUsage {
    const key = fontKey(font);
    let usage = this.usages.get(key);
    if (!usage) {
      usage = {
        key,
        font: { family: font.family, style: font.style },
        missing: !this.availableKeys.has(key),
        layerCount: 0,
        rangeCount: 0,
        nodeIds: [],
        styleCount: 0,
      };
      this.usages.set(key, usage);
      this.nodeSeen.set(key, new Set());
    }
    return usage;
  }
}

export interface ReplaceContext {
  mapping: Map<string, Font>;
  options: ReplaceOptions;
  /** Loads a font. Resolves false when the font cannot load. */
  loadFont: (font: Font) => Promise<boolean>;
  /** IDs of local text styles in this file. */
  localStyleIds: Set<string>;
  /** IDs of local text styles that this run already updated. */
  updatedStyleIds: Set<string>;
}

export interface NodeOutcome {
  ranges: number;
  skip?: SkipReason;
}

export async function replaceInNode(node: TextLike, ctx: ReplaceContext): Promise<NodeOutcome> {
  if (ctx.options.skipLocked && isLockedChain(node)) return { ranges: 0, skip: "locked" };
  if (!ctx.options.includeHidden && isHiddenChain(node)) return { ranges: 0, skip: "hidden" };

  const segments = node.getStyledTextSegments(["fontName", "textStyleId"]);
  let ranges = 0;
  let skip: SkipReason | undefined;

  for (const segment of segments) {
    const target = ctx.mapping.get(fontKey(segment.fontName));
    if (!target) continue;

    const styleId = segment.textStyleId;
    if (styleId) {
      // The range follows a style that this run already changed.
      if (ctx.updatedStyleIds.has(styleId)) continue;
      // A library style. A direct change detaches it, so leave it and report it.
      if (!ctx.localStyleIds.has(styleId)) {
        skip = skip ?? "remote-style";
        continue;
      }
    }

    if (!(await ctx.loadFont(target))) {
      skip = skip ?? "target-unavailable";
      continue;
    }
    // The source font can be missing. Figma still allows a fontName change in that case.
    await ctx.loadFont(segment.fontName);
    node.setRangeFontName(segment.start, segment.end, target);
    ranges += 1;
  }

  return ranges === 0 && skip ? { ranges, skip } : { ranges };
}
