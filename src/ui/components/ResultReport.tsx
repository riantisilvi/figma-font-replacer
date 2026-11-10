// Outcome of a replace run, with skipped and failed layers the user can locate.
import type { ReplaceResult, SkipReason } from "../../shared/types";
import { Badge, Button, Icon } from "./primitives";

const REASON_LABEL: Record<SkipReason, string> = {
  locked: "Locked layer",
  hidden: "Hidden layer",
  "remote-style": "Uses a library text style",
  "target-unavailable": "Replacement font cannot load",
  "not-editable": "Not editable",
};

export interface ResultReportProps {
  result: ReplaceResult;
  onLocate: (nodeIds: string[]) => void;
  onDismiss: () => void;
}

export function ResultReport({ result, onLocate, onDismiss }: ResultReportProps) {
  const groups = new Map<SkipReason, string[]>();
  for (const s of result.skipped) {
    groups.set(s.reason, [...(groups.get(s.reason) ?? []), s.nodeId]);
  }
  const hasIssues = result.skipped.length > 0 || result.failed.length > 0;
  const failedLayerIds = result.failed.filter((f) => !f.name.startsWith("Text style:")).map((f) => f.nodeId);

  return (
    <section role="status" aria-live="polite" aria-label="Replace result" className="space-y-2 border-t border-border px-3 py-2.5">
      <div className="flex items-center gap-2">
        <span className={result.layersChanged + result.stylesUpdated > 0 ? "text-fg-success" : "text-fg-secondary"}>
          <Icon name={result.layersChanged + result.stylesUpdated > 0 ? "check" : "warning"} />
        </span>
        <p className="flex-1 text-sm">
          <strong className="font-semibold">{result.layersChanged.toLocaleString()}</strong> layers and{" "}
          <strong className="font-semibold">{result.stylesUpdated.toLocaleString()}</strong> text styles changed
          <span className="text-fg-secondary"> in {(result.durationMs / 1000).toFixed(1)}s</span>
        </p>
        <Button size="sm" variant="ghost" onClick={onDismiss}>
          Done
        </Button>
      </div>

      {hasIssues && (
        <ul className="space-y-1">
          {[...groups.entries()].map(([reason, ids]) => (
            <li key={reason} className="flex items-center gap-2">
              <Badge variant="warning">Skipped</Badge>
              <span className="flex-1 text-sm">
                {REASON_LABEL[reason]} ({ids.length})
              </span>
              <Button size="sm" variant="ghost" onClick={() => onLocate(ids)}>
                Select
              </Button>
            </li>
          ))}
          {result.failed.length > 0 && (
            <li className="flex items-center gap-2">
              <Badge variant="danger">Failed</Badge>
              <span className="flex-1 truncate text-sm" title={result.failed.map((f) => `${f.name}: ${f.error}`).join("\n")}>
                {result.failed.length} items: {result.failed[0].error}
              </span>
              {failedLayerIds.length > 0 && (
                <Button size="sm" variant="ghost" onClick={() => onLocate(failedLayerIds)}>
                  Select
                </Button>
              )}
            </li>
          )}
        </ul>
      )}
      <p className="text-xs text-fg-secondary">Press Cmd+Z (Ctrl+Z on Windows) in Figma to undo this run.</p>
    </section>
  );
}
