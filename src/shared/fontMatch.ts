// Pure font helpers. No Figma globals here, so this file runs in tests and in the UI.
import type { Font } from "./types";

export function fontKey(font: Font): string {
  return `${font.family}\u0000${font.style}`;
}

export function fontLabel(font: Font): string {
  return `${font.family} ${font.style}`;
}

export function sameFont(a: Font, b: Font): boolean {
  return a.family === b.family && a.style === b.style;
}

export interface StyleTraits {
  weight: number;
  italic: boolean;
  /** 1 = normal. Below 1 = condensed, above 1 = expanded. */
  width: number;
}

// Longest tokens first, so "SemiBold" is found before "Bold".
const WEIGHT_TOKENS: Array<[string, number]> = [
  ["extralight", 200],
  ["ultralight", 200],
  ["extrabold", 800],
  ["ultrabold", 800],
  ["semibold", 600],
  ["demibold", 600],
  ["hairline", 100],
  ["regular", 400],
  ["medium", 500],
  ["normal", 400],
  ["heavy", 900],
  ["black", 900],
  ["light", 300],
  ["thin", 100],
  ["book", 400],
  ["roman", 400],
  ["bold", 700],
  ["semi", 600],
  ["demi", 600],
];

const WIDTH_TOKENS: Array<[string, number]> = [
  ["ultracondensed", 0.5],
  ["extracondensed", 0.625],
  ["semicondensed", 0.875],
  ["condensed", 0.75],
  ["narrow", 0.75],
  ["compressed", 0.625],
  ["semiexpanded", 1.125],
  ["extraexpanded", 1.5],
  ["expanded", 1.25],
  ["extended", 1.25],
  ["wide", 1.25],
];

function normalize(style: string): string {
  return style.toLowerCase().replace(/[\s_-]+/g, "");
}

export function parseStyle(style: string): StyleTraits {
  let s = normalize(style);
  const italic = /italic|oblique/.test(s);
  s = s.replace(/italic|oblique/g, "");

  let width = 1;
  for (const [token, value] of WIDTH_TOKENS) {
    if (s.includes(token)) {
      width = value;
      s = s.replace(token, "");
      break;
    }
  }

  // Numeric weights, for example "Inter 600" or "W7".
  const numeric = s.match(/(?:^|[a-z])([1-9]00)(?![0-9])/);
  if (numeric) {
    return { weight: Number(numeric[1]), italic, width };
  }

  for (const [token, value] of WEIGHT_TOKENS) {
    if (s.includes(token)) {
      return { weight: value, italic, width };
    }
  }
  return { weight: 400, italic, width };
}

/**
 * Lower score is a better match. Exact name match is 0.
 * Italic mismatch costs most, then width, then weight distance.
 */
export function styleDistance(source: string, candidate: string): number {
  if (normalize(source) === normalize(candidate)) return 0;
  const a = parseStyle(source);
  const b = parseStyle(candidate);
  let score = 1;
  if (a.italic !== b.italic) score += 10_000;
  score += Math.abs(a.width - b.width) * 2_000;
  const delta = b.weight - a.weight;
  // CSS fallback rule: for the same distance, prefer the heavier weight for
  // weights above 500, and the lighter weight for weights 500 and below.
  score += Math.abs(delta) * 2 + (delta === 0 ? 0 : (a.weight > 500 ? delta < 0 : delta > 0) ? 1 : 0);
  return score;
}

/** Returns the style of `targetFamily` that is nearest to `sourceStyle`. */
export function matchStyle(sourceStyle: string, targetStyles: string[]): string | null {
  if (targetStyles.length === 0) return null;
  let best = targetStyles[0];
  let bestScore = Number.POSITIVE_INFINITY;
  for (const candidate of targetStyles) {
    const score = styleDistance(sourceStyle, candidate);
    if (score < bestScore) {
      best = candidate;
      bestScore = score;
    }
  }
  return best;
}

/** Groups available fonts as family to ordered styles (by weight, then italic). */
export function indexFonts(fonts: Font[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const font of fonts) {
    const styles = map.get(font.family);
    if (styles) {
      if (!styles.includes(font.style)) styles.push(font.style);
    } else {
      map.set(font.family, [font.style]);
    }
  }
  for (const styles of map.values()) {
    styles.sort((a, b) => {
      const ta = parseStyle(a);
      const tb = parseStyle(b);
      return ta.width - tb.width || ta.weight - tb.weight || Number(ta.italic) - Number(tb.italic);
    });
  }
  return map;
}

/** Case-insensitive search. Prefix matches rank before substring matches. */
export function searchFamilies(families: string[], query: string, limit = 80): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return families.slice(0, limit);
  const prefix: string[] = [];
  const contains: string[] = [];
  for (const family of families) {
    const f = family.toLowerCase();
    if (f.startsWith(q)) prefix.push(family);
    else if (f.includes(q)) contains.push(family);
    if (prefix.length >= limit) break;
  }
  return prefix.concat(contains).slice(0, limit);
}
