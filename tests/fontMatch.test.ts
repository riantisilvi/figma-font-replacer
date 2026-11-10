import { describe, expect, it } from "vitest";
import { indexFonts, matchStyle, parseStyle, searchFamilies } from "../src/shared/fontMatch";

describe("parseStyle", () => {
  it.each([
    ["Regular", 400, false],
    ["Italic", 400, true],
    ["SemiBold", 600, false],
    ["Semi Bold Italic", 600, true],
    ["ExtraLight", 200, false],
    ["Bold", 700, false],
    ["ExtraBold Italic", 800, true],
    ["Black", 900, false],
    ["Thin Oblique", 100, true],
    ["Book", 400, false],
    ["600", 600, false],
  ])("%s gives weight %d", (style, weight, italic) => {
    const traits = parseStyle(style);
    expect(traits.weight).toBe(weight);
    expect(traits.italic).toBe(italic);
  });

  it("reads width", () => {
    expect(parseStyle("Condensed Bold").width).toBeLessThan(1);
    expect(parseStyle("Bold").width).toBe(1);
  });
});

describe("matchStyle", () => {
  const geist = ["Thin", "Light", "Regular", "Medium", "SemiBold", "Bold", "Black"];
  const withItalic = ["Regular", "Italic", "Bold", "Bold Italic"];

  it("prefers exact names", () => {
    expect(matchStyle("Medium", geist)).toBe("Medium");
  });

  it("matches synonyms by weight", () => {
    expect(matchStyle("Semi Bold", geist)).toBe("SemiBold");
    expect(matchStyle("Heavy", geist)).toBe("Black");
    expect(matchStyle("Book", geist)).toBe("Regular");
  });

  it("keeps italic before weight", () => {
    expect(matchStyle("SemiBold Italic", withItalic)).toBe("Bold Italic");
    expect(matchStyle("Light Italic", withItalic)).toBe("Italic");
  });

  it("falls back to the nearest weight when italic is absent", () => {
    expect(matchStyle("Bold Italic", geist)).toBe("Bold");
  });

  it("breaks ties with the CSS fallback direction", () => {
    // 600 is equally far from 500 and 700. Above 500, prefer heavier.
    expect(matchStyle("SemiBold", ["Medium", "Bold"])).toBe("Bold");
    // 400 is equally far from 300 and 500. At 500 and below, prefer lighter.
    expect(matchStyle("Regular", ["Light", "Medium"])).toBe("Light");
  });

  it("returns null for an empty list", () => {
    expect(matchStyle("Regular", [])).toBeNull();
  });
});

describe("indexFonts", () => {
  it("groups and sorts styles by weight then italic", () => {
    const index = indexFonts([
      { family: "Inter", style: "Bold" },
      { family: "Inter", style: "Italic" },
      { family: "Inter", style: "Regular" },
      { family: "Inter", style: "Regular" },
      { family: "Roboto", style: "Regular" },
    ]);
    expect(index.get("Inter")).toEqual(["Regular", "Italic", "Bold"]);
    expect(index.get("Roboto")).toEqual(["Regular"]);
  });
});

describe("searchFamilies", () => {
  const families = ["Geist", "Geist Mono", "IBM Plex Sans", "Inter", "Noto Sans", "Source Sans 3"];
  it("finds substring matches", () => {
    expect(searchFamilies(families, "sans")).toEqual(["IBM Plex Sans", "Noto Sans", "Source Sans 3"]);
  });
  it("ranks prefix matches first", () => {
    expect(searchFamilies(families, "s")).toEqual(["Source Sans 3", "Geist", "Geist Mono", "IBM Plex Sans", "Noto Sans"]);
  });
  it("is case-insensitive", () => {
    expect(searchFamilies(families, "geist")).toEqual(["Geist", "Geist Mono"]);
  });
  it("returns the head of the list for an empty query", () => {
    expect(searchFamilies(families, "", 2)).toEqual(["Geist", "Geist Mono"]);
  });
});
