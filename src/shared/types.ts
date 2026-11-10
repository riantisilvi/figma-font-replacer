// Message contract between the UI iframe and the plugin main thread.

export interface Font {
  family: string;
  style: string;
}

export type Scope = "selection" | "page" | "document";

export interface FontUsage {
  /** Stable key, see fontKey(). */
  key: string;
  font: Font;
  /** True when the font is not in figma.listAvailableFontsAsync(). */
  missing: boolean;
  /** Number of text layers that use this font in at least one range. */
  layerCount: number;
  /** Number of character ranges that use this font. */
  rangeCount: number;
  /** Text layer IDs, used to select layers on the canvas. */
  nodeIds: string[];
  /** Number of local text styles that use this font. */
  styleCount: number;
}

export interface Mapping {
  from: Font;
  to: Font;
}

export interface ReplaceOptions {
  /** Skip text layers that are locked, or that have a locked ancestor. */
  skipLocked: boolean;
  /** Also update local text styles. Ranges bound to an updated style follow the style. */
  updateTextStyles: boolean;
  /** Include text inside hidden layers. */
  includeHidden: boolean;
}

export type SkipReason =
  | "locked"
  | "hidden"
  | "remote-style"
  | "target-unavailable"
  | "not-editable";

export interface SkippedLayer {
  nodeId: string;
  name: string;
  reason: SkipReason;
}

export interface FailedLayer {
  nodeId: string;
  name: string;
  error: string;
}

export interface ReplaceResult {
  layersChanged: number;
  rangesChanged: number;
  stylesUpdated: number;
  skipped: SkippedLayer[];
  failed: FailedLayer[];
  durationMs: number;
}

export interface Preset {
  id: string;
  name: string;
  /** Source family to target family. */
  families: Record<string, string>;
  /** Source font key to explicit target font (style overrides). */
  overrides: Record<string, Font>;
  updatedAt: number;
}

export type UiToCode =
  | { type: "init" }
  | { type: "scan"; scope: Scope; includeHidden: boolean }
  | { type: "replace"; scope: Scope; mappings: Mapping[]; options: ReplaceOptions }
  | { type: "select-nodes"; nodeIds: string[] }
  | { type: "save-preset"; preset: Preset }
  | { type: "delete-preset"; id: string }
  | { type: "notify"; message: string; error?: boolean };

export type CodeToUi =
  | { type: "fonts"; fonts: Font[] }
  | { type: "presets"; presets: Preset[] }
  | { type: "selection"; count: number }
  | { type: "progress"; phase: "scan" | "replace"; done: number; total: number }
  | { type: "scan-result"; scope: Scope; usages: FontUsage[]; textLayerCount: number }
  | { type: "replace-result"; result: ReplaceResult }
  | { type: "error"; message: string };
