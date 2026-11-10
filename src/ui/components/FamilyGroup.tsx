// One source family with a family-level target picker and one row per style.
import { memo } from "react";
import type { Font, FontUsage } from "../../shared/types";
import { FontCombobox } from "./FontCombobox";
import { Badge, Button, cn, Icon } from "./primitives";

export interface StyleRowModel {
  usage: FontUsage;
  /** Resolved target, or null when the family has no target. */
  target: Font | null;
  /** True when the style was picked by hand and not by auto-match. */
  overridden: boolean;
}

export interface FamilyGroupProps {
  family: string;
  rows: StyleRowModel[];
  families: string[];
  targetFamily: string | null;
  targetStyles: string[];
  disabled: boolean;
  onTargetFamily: (sourceFamily: string, targetFamily: string | null) => void;
  onTargetStyle: (usage: FontUsage, style: string | null) => void;
  onLocate: (nodeIds: string[]) => void;
}

export const FamilyGroup = memo(function FamilyGroup({
  family,
  rows,
  families,
  targetFamily,
  targetStyles,
  disabled,
  onTargetFamily,
  onTargetStyle,
  onLocate,
}: FamilyGroupProps) {
  const totalLayers = rows.reduce((sum, r) => sum + r.usage.layerCount, 0);
  const missingCount = rows.filter((r) => r.usage.missing).length;
  const headingId = `family-${family.replace(/[^a-z0-9]/gi, "-")}`;

  return (
    <section aria-labelledby={headingId} className="border-b border-border px-3 py-2.5">
      <div className="mb-2 flex items-center gap-2">
        <h2 id={headingId} className="min-w-0 flex-1 truncate text-base font-semibold">
          {family}
        </h2>
        {missingCount > 0 && (
          <Badge variant="danger">
            <span className="text-fg-danger">
              <Icon name="warning" />
            </span>
            <span className="ml-0.5">Missing</span>
          </Badge>
        )}
        <span className="text-xs tabular-nums text-fg-secondary">
          {totalLayers.toLocaleString()} {totalLayers === 1 ? "layer" : "layers"}
        </span>
      </div>

      <div className="mb-2 flex items-center gap-2">
        <span className="w-[76px] shrink-0 whitespace-nowrap text-xs text-fg-secondary" aria-hidden="true">
          Replace with
        </span>
        <FontCombobox
          label={`Replacement family for ${family}`}
          families={families}
          value={targetFamily}
          placeholder="Keep current font"
          disabled={disabled}
          onChange={(value) => onTargetFamily(family, value)}
        />
      </div>

      <ul className="space-y-1" aria-label={`${family} styles`}>
        {rows.map(({ usage, target, overridden }) => {
          const unchanged = target !== null && target.family === usage.font.family && target.style === usage.font.style;
          return (
            <li key={usage.key} className="flex items-center gap-2">
              <div className="flex w-[110px] shrink-0 items-center gap-1.5">
                <span
                  className={cn("truncate text-sm", usage.missing ? "text-fg-danger" : "")}
                  title={usage.missing ? `${usage.font.style} is not installed` : usage.font.style}
                >
                  {usage.font.style}
                </span>
                {usage.missing && <span className="sr-only">(missing)</span>}
              </div>

              <Button
                variant="ghost"
                size="sm"
                className="w-14 justify-start px-1 tabular-nums"
                aria-label={`Select ${usage.layerCount} layers that use ${family} ${usage.font.style}`}
                title="Select these layers on the canvas"
                disabled={usage.nodeIds.length === 0}
                onClick={() => onLocate(usage.nodeIds)}
              >
                <Icon name="target" />
                {usage.layerCount}
              </Button>

              <span className="text-fg-tertiary" aria-hidden="true">
                →
              </span>

              <select
                aria-label={`Replacement style for ${family} ${usage.font.style}`}
                className={cn("field min-w-0 flex-1 pr-1", overridden ? "font-medium" : "", unchanged ? "text-fg-tertiary" : "")}
                disabled={disabled || !targetFamily}
                value={target?.style ?? ""}
                onChange={(e) => onTargetStyle(usage, e.target.value || null)}
              >
                {!targetFamily && <option value="">No change</option>}
                {targetStyles.map((style) => (
                  <option key={style} value={style}>
                    {style}
                  </option>
                ))}
              </select>
              {overridden ? (
                <button
                  type="button"
                  className="shrink-0 rounded p-0.5 text-fg-tertiary hover:bg-bg-hover hover:text-fg"
                  aria-label={`Reset ${family} ${usage.font.style} to auto-match`}
                  title="Reset to auto-match"
                  onClick={() => onTargetStyle(usage, null)}
                >
                  <Icon name="close" />
                </button>
              ) : (
                <span className="w-[18px] shrink-0" aria-hidden="true" />
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
});
