import { describe, expect, it } from "vitest";
import { indexFonts } from "../src/shared/fontMatch";
import { applyPreset, buildMappings, presetFromState, resolveTarget } from "../src/shared/mapping";
import type { FontUsage } from "../src/shared/types";

const fontIndex = indexFonts([
  ...["Regular", "Medium", "SemiBold", "Bold"].map((style) => ({ family: "Geist", style })),
  ...["Regular", "Bold"].map((style) => ({ family: "Inter", style })),
]);

function usage(family: string, style: string): FontUsage {
  return {
    key: `${family}\u0000${style}`,
    font: { family, style },
    missing: false,
    layerCount: 1,
    rangeCount: 1,
    nodeIds: ["1:1"],
    styleCount: 0,
  };
}

const usages = [usage("Inter", "Regular"), usage("Inter", "Semi Bold"), usage("Roboto", "Bold")];

describe("resolveTarget", () => {
  it("returns null without a family target", () => {
    expect(resolveTarget(usages[0], { familyTargets: {}, overrides: {} }, fontIndex)).toEqual({ target: null, overridden: false });
  });

  it("auto-matches the style", () => {
    const state = { familyTargets: { Inter: "Geist" }, overrides: {} };
    expect(resolveTarget(usages[1], state, fontIndex).target).toEqual({ family: "Geist", style: "SemiBold" });
  });

  it("uses a valid override", () => {
    const state = { familyTargets: { Inter: "Geist" }, overrides: { [usages[1].key]: { family: "Geist", style: "Bold" } } };
    expect(resolveTarget(usages[1], state, fontIndex)).toEqual({ target: { family: "Geist", style: "Bold" }, overridden: true });
  });

  it("ignores an override for another family", () => {
    const state = { familyTargets: { Inter: "Geist" }, overrides: { [usages[1].key]: { family: "Inter", style: "Bold" } } };
    expect(resolveTarget(usages[1], state, fontIndex).overridden).toBe(false);
  });
});

describe("buildMappings", () => {
  it("leaves out unmapped and unchanged fonts", () => {
    const state = { familyTargets: { Inter: "Inter" }, overrides: { [usages[1].key]: { family: "Inter", style: "Bold" } } };
    const mappings = buildMappings(usages, state, fontIndex);
    expect(mappings).toEqual([{ from: { family: "Inter", style: "Semi Bold" }, to: { family: "Inter", style: "Bold" } }]);
  });
});

describe("presets", () => {
  it("round-trips and applies only to families in the scan", () => {
    const preset = presetFromState("Inter to Geist", {
      familyTargets: { Inter: "Geist", Poppins: "Geist" },
      overrides: { [usages[0].key]: { family: "Geist", style: "Medium" } },
    });
    const { state, matched } = applyPreset(preset, usages, fontIndex);
    expect(matched).toBe(1);
    expect(state.familyTargets).toEqual({ Inter: "Geist" });
    expect(state.overrides[usages[0].key]).toEqual({ family: "Geist", style: "Medium" });
  });

  it("skips a target family that is not installed", () => {
    const preset = presetFromState("To Satoshi", { familyTargets: { Inter: "Satoshi" }, overrides: {} });
    expect(applyPreset(preset, usages, fontIndex).matched).toBe(0);
  });
});
