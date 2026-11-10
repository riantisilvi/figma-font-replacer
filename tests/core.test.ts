import { describe, expect, it } from "vitest";
import { isHiddenChain, isLockedChain, replaceInNode, UsageCollector } from "../src/shared/core";
import type { ParentLike, ReplaceContext, Segment, TextLike } from "../src/shared/core";
import { fontKey } from "../src/shared/fontMatch";
import type { Font } from "../src/shared/types";

const PAGE: ParentLike = { type: "PAGE", parent: null };
const inter = (style: string): Font => ({ family: "Inter", style });
const geist = (style: string): Font => ({ family: "Geist", style });

interface MockText extends TextLike {
  segments: Segment[];
  calls: Array<[number, number, Font]>;
}

function mockText(segments: Array<[number, number, Font, string?]>, extra: Partial<ParentLike> = {}, parent: ParentLike = PAGE): MockText {
  const node: MockText = {
    id: `n${Math.random().toString(36).slice(2, 7)}`,
    name: "Text",
    type: "TEXT",
    parent,
    locked: false,
    visible: true,
    ...extra,
    segments: segments.map(([start, end, fontName, textStyleId = ""]) => ({ start, end, fontName, textStyleId })),
    calls: [],
    getStyledTextSegments() {
      return node.segments;
    },
    setRangeFontName(start, end, font) {
      node.calls.push([start, end, font]);
      for (const s of node.segments) if (s.start === start && s.end === end) s.fontName = font;
    },
  };
  return node;
}

function ctx(overrides: Partial<ReplaceContext> = {}): ReplaceContext {
  return {
    mapping: new Map([
      [fontKey(inter("Regular")), geist("Regular")],
      [fontKey(inter("Bold")), geist("Bold")],
    ]),
    options: { skipLocked: true, updateTextStyles: true, includeHidden: false },
    loadFont: async () => true,
    localStyleIds: new Set(["S:local"]),
    updatedStyleIds: new Set(),
    ...overrides,
  };
}

describe("UsageCollector", () => {
  it("counts layers once and ranges each time", () => {
    const available = new Set([fontKey(inter("Regular"))]);
    const collector = new UsageCollector(available);
    collector.addNode(mockText([[0, 3, inter("Regular")], [3, 6, inter("Bold")], [6, 9, inter("Regular")]]));
    collector.addNode(mockText([[0, 4, inter("Regular")]]));
    collector.addStyle(inter("Bold"));

    const result = collector.result();
    const regular = result.find((u) => u.font.style === "Regular")!;
    const bold = result.find((u) => u.font.style === "Bold")!;

    expect(regular.layerCount).toBe(2);
    expect(regular.rangeCount).toBe(3);
    expect(regular.missing).toBe(false);
    expect(bold.layerCount).toBe(1);
    expect(bold.styleCount).toBe(1);
    expect(bold.missing).toBe(true);
    // Missing fonts sort first.
    expect(result[0].font.style).toBe("Bold");
  });
});

describe("ancestor checks", () => {
  it("finds a locked ancestor", () => {
    const frame: ParentLike = { type: "FRAME", locked: true, parent: PAGE };
    expect(isLockedChain(mockText([], {}, frame))).toBe(true);
    expect(isLockedChain(mockText([]))).toBe(false);
  });

  it("finds a hidden ancestor", () => {
    const group: ParentLike = { type: "GROUP", visible: false, parent: PAGE };
    expect(isHiddenChain(mockText([], {}, group))).toBe(true);
  });
});

describe("replaceInNode", () => {
  it("replaces only mapped ranges and keeps the other ranges", async () => {
    const node = mockText([[0, 5, inter("Regular")], [5, 9, inter("Medium")], [9, 12, inter("Bold")]]);
    const outcome = await replaceInNode(node, ctx());
    expect(outcome).toEqual({ ranges: 2 });
    expect(node.calls).toEqual([
      [0, 5, geist("Regular")],
      [9, 12, geist("Bold")],
    ]);
    expect(node.segments[1].fontName).toEqual(inter("Medium"));
  });

  it("skips locked layers when the option is on", async () => {
    const node = mockText([[0, 5, inter("Regular")]], { locked: true });
    expect(await replaceInNode(node, ctx())).toEqual({ ranges: 0, skip: "locked" });
    expect(node.calls).toHaveLength(0);
  });

  it("changes locked layers when the option is off", async () => {
    const node = mockText([[0, 5, inter("Regular")]], { locked: true });
    const c = ctx();
    c.options = { ...c.options, skipLocked: false };
    expect(await replaceInNode(node, c)).toEqual({ ranges: 1 });
  });

  it("skips hidden layers unless hidden layers are included", async () => {
    const node = mockText([[0, 5, inter("Regular")]], { visible: false });
    expect((await replaceInNode(node, ctx())).skip).toBe("hidden");
    const c = ctx();
    c.options = { ...c.options, includeHidden: true };
    expect((await replaceInNode(node, c)).ranges).toBe(1);
  });

  it("leaves ranges that follow an updated local style", async () => {
    const node = mockText([[0, 5, inter("Regular"), "S:local"]]);
    const outcome = await replaceInNode(node, ctx({ updatedStyleIds: new Set(["S:local"]) }));
    expect(outcome).toEqual({ ranges: 0 });
    expect(node.calls).toHaveLength(0);
  });

  it("overrides ranges with a local style when styles are not updated", async () => {
    const node = mockText([[0, 5, inter("Regular"), "S:local"]]);
    expect(await replaceInNode(node, ctx())).toEqual({ ranges: 1 });
  });

  it("reports library styles and does not detach them", async () => {
    const node = mockText([[0, 5, inter("Regular"), "S:remote,123"]]);
    expect(await replaceInNode(node, ctx())).toEqual({ ranges: 0, skip: "remote-style" });
    expect(node.calls).toHaveLength(0);
  });

  it("reports a target font that cannot load", async () => {
    const node = mockText([[0, 5, inter("Regular")]]);
    const loadFont = async (font: Font) => font.family !== "Geist";
    expect(await replaceInNode(node, ctx({ loadFont }))).toEqual({ ranges: 0, skip: "target-unavailable" });
  });

  it("still replaces when the source font is missing", async () => {
    const node = mockText([[0, 5, inter("Regular")]]);
    const loadFont = async (font: Font) => font.family !== "Inter";
    expect(await replaceInNode(node, ctx({ loadFont }))).toEqual({ ranges: 1 });
  });
});
