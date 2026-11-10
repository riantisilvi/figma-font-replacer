// Turns the UI state (family targets plus style overrides) into concrete mappings.
import { fontKey, matchStyle } from "./fontMatch";
import type { Font, FontUsage, Mapping, Preset } from "./types";

export interface MappingState {
  /** Source family to target family. */
  familyTargets: Record<string, string>;
  /** Source font key to explicit target font. Valid only when its family equals the family target. */
  overrides: Record<string, Font>;
}

export interface ResolvedTarget {
  target: Font | null;
  overridden: boolean;
}

export function resolveTarget(usage: FontUsage, state: MappingState, fontIndex: Map<string, string[]>): ResolvedTarget {
  const family = state.familyTargets[usage.font.family];
  if (!family) return { target: null, overridden: false };
  const styles = fontIndex.get(family) ?? [];
  const override = state.overrides[usage.key];
  if (override && override.family === family && styles.includes(override.style)) {
    return { target: override, overridden: true };
  }
  const style = matchStyle(usage.font.style, styles);
  return { target: style ? { family, style } : null, overridden: false };
}

export function buildMappings(usages: FontUsage[], state: MappingState, fontIndex: Map<string, string[]>): Mapping[] {
  const mappings: Mapping[] = [];
  for (const usage of usages) {
    const { target } = resolveTarget(usage, state, fontIndex);
    if (target && fontKey(target) !== usage.key) mappings.push({ from: usage.font, to: target });
  }
  return mappings;
}

/** Applies a preset to the families present in the current scan. Returns the number of families it matched. */
export function applyPreset(preset: Preset, usages: FontUsage[], fontIndex: Map<string, string[]>): { state: MappingState; matched: number } {
  const present = new Set(usages.map((u) => u.font.family));
  const familyTargets: Record<string, string> = {};
  const overrides: Record<string, Font> = {};
  let matched = 0;
  for (const [source, target] of Object.entries(preset.families)) {
    if (present.has(source) && fontIndex.has(target)) {
      familyTargets[source] = target;
      matched += 1;
    }
  }
  for (const [key, font] of Object.entries(preset.overrides)) {
    const usage = usages.find((u) => u.key === key);
    if (usage && familyTargets[usage.font.family] === font.family) overrides[key] = font;
  }
  return { state: { familyTargets, overrides }, matched };
}

export function presetFromState(name: string, state: MappingState, id?: string): Preset {
  return {
    id: id ?? `preset-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    name,
    families: { ...state.familyTargets },
    overrides: { ...state.overrides },
    updatedAt: Date.now(),
  };
}
