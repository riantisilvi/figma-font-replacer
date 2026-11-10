import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { indexFonts } from "../shared/fontMatch";
import { applyPreset, buildMappings, presetFromState, resolveTarget } from "../shared/mapping";
import type { MappingState } from "../shared/mapping";
import type { Font, FontUsage, Preset, ReplaceResult, Scope } from "../shared/types";
import { listen, send } from "./bridge";
import { FamilyGroup } from "./components/FamilyGroup";
import type { StyleRowModel } from "./components/FamilyGroup";
import { PresetBar } from "./components/PresetBar";
import { Badge, Button, Checkbox, ProgressBar, SegmentedControl, Spinner } from "./components/primitives";
import { ResultReport } from "./components/ResultReport";

type Status = "loading" | "idle" | "scanning" | "ready" | "replacing" | "done" | "error";

const EMPTY_STATE: MappingState = { familyTargets: {}, overrides: {} };

export function App() {
  const [status, setStatus] = useState<Status>("loading");
  const [fonts, setFonts] = useState<Font[]>([]);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [selectionCount, setSelectionCount] = useState(0);

  const [scope, setScope] = useState<Scope>("page");
  const [includeHidden, setIncludeHidden] = useState(false);
  const [skipLocked, setSkipLocked] = useState(true);
  const [updateTextStyles, setUpdateTextStyles] = useState(true);
  const [missingOnly, setMissingOnly] = useState(false);

  const [usages, setUsages] = useState<FontUsage[] | null>(null);
  const [scannedScope, setScannedScope] = useState<Scope | null>(null);
  const [textLayerCount, setTextLayerCount] = useState(0);
  const [mapping, setMapping] = useState<MappingState>(EMPTY_STATE);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [result, setResult] = useState<ReplaceResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fontIndex = useMemo(() => indexFonts(fonts), [fonts]);
  const families = useMemo(() => [...fontIndex.keys()].sort((a, b) => a.localeCompare(b)), [fontIndex]);

  const scan = useCallback(
    (nextScope: Scope = scope) => {
      setStatus("scanning");
      setProgress(null);
      setResult(null);
      setError(null);
      send({ type: "scan", scope: nextScope, includeHidden });
    },
    [scope, includeHidden],
  );

  useEffect(() => {
    const stop = listen((message) => {
      switch (message.type) {
        case "fonts":
          setFonts(message.fonts);
          setStatus((s) => (s === "loading" ? "idle" : s));
          break;
        case "presets":
          setPresets(message.presets);
          break;
        case "selection":
          setSelectionCount(message.count);
          break;
        case "progress":
          setProgress({ done: message.done, total: message.total });
          break;
        case "scan-result":
          setUsages(message.usages);
          setScannedScope(message.scope);
          setTextLayerCount(message.textLayerCount);
          setProgress(null);
          // A rescan after a replace keeps the result report open.
          setStatus((s) => (s === "done" ? "done" : "ready"));
          break;
        case "replace-result":
          setResult(message.result);
          setProgress(null);
          setStatus("done");
          break;
        case "error":
          setError(message.message);
          setProgress(null);
          setStatus("error");
          break;
      }
    });
    send({ type: "init" });
    return stop;
  }, []);

  // Rescan after a replace, so the list shows the new state of the file.
  useEffect(() => {
    if (status === "done" && result && result.layersChanged + result.stylesUpdated > 0 && scannedScope) {
      send({ type: "scan", scope: scannedScope, includeHidden });
    }
    // Run once per result.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  const groups = useMemo(() => {
    if (!usages) return [];
    const byFamily = new Map<string, StyleRowModel[]>();
    for (const usage of usages) {
      if (missingOnly && !usage.missing) continue;
      if (usage.layerCount === 0 && usage.styleCount === 0) continue;
      const rows = byFamily.get(usage.font.family) ?? [];
      rows.push({ usage, ...resolveTarget(usage, mapping, fontIndex) });
      byFamily.set(usage.font.family, rows);
    }
    return [...byFamily.entries()]
      .map(([family, rows]) => ({ family, rows, missing: rows.some((r) => r.usage.missing) }))
      .sort((a, b) => Number(b.missing) - Number(a.missing) || a.family.localeCompare(b.family));
  }, [usages, missingOnly, mapping, fontIndex]);

  const mappings = useMemo(() => (usages ? buildMappings(usages, mapping, fontIndex) : []), [usages, mapping, fontIndex]);
  const affectedLayers = useMemo(() => {
    if (!usages) return 0;
    const ids = new Set<string>();
    const keys = new Set(mappings.map((m) => `${m.from.family}\u0000${m.from.style}`));
    for (const u of usages) if (keys.has(u.key)) u.nodeIds.forEach((id) => ids.add(id));
    return ids.size;
  }, [usages, mappings]);

  const missingCount = usages?.filter((u) => u.missing).length ?? 0;
  const busy = status === "scanning" || status === "replacing" || status === "loading";
  const stale = scannedScope !== null && scannedScope !== scope;

  const onTargetFamily = useCallback((source: string, target: string | null) => {
    setMapping((prev) => {
      const familyTargets = { ...prev.familyTargets };
      if (target) familyTargets[source] = target;
      else delete familyTargets[source];
      const overrides = Object.fromEntries(
        Object.entries(prev.overrides).filter(([key]) => !key.startsWith(`${source}\u0000`)),
      );
      return { familyTargets, overrides };
    });
  }, []);

  const onTargetStyle = useCallback((usage: FontUsage, style: string | null) => {
    setMapping((prev) => {
      const overrides = { ...prev.overrides };
      const family = prev.familyTargets[usage.font.family];
      if (style && family) overrides[usage.key] = { family, style };
      else delete overrides[usage.key];
      return { ...prev, overrides };
    });
  }, []);

  const onLocate = useCallback((nodeIds: string[]) => send({ type: "select-nodes", nodeIds }), []);

  function replace() {
    if (!scannedScope || mappings.length === 0) return;
    setStatus("replacing");
    setProgress(null);
    setResult(null);
    send({
      type: "replace",
      scope: scannedScope,
      mappings,
      options: { skipLocked, updateTextStyles, includeHidden },
    });
  }

  function onApplyPreset(preset: Preset) {
    if (!usages) return;
    const { state, matched } = applyPreset(preset, usages, fontIndex);
    setMapping(state);
    send({
      type: "notify",
      message: matched > 0 ? `Preset "${preset.name}" applied to ${matched} families` : `No family in "${preset.name}" is in this scan`,
      error: matched === 0,
    });
  }

  function onSavePreset(name: string) {
    const existing = presets.find((p) => p.name === name);
    send({ type: "save-preset", preset: presetFromState(name, mapping, existing?.id) });
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header: scope and scan */}
      <header className="space-y-2 border-b border-border px-3 py-2.5">
        <h1 className="sr-only">Font Replacer</h1>
        <div className="flex items-center gap-2">
          <SegmentedControl<Scope>
            label="Scan scope"
            value={scope}
            disabled={busy}
            onChange={setScope}
            options={[
              { value: "selection", label: `Selection${selectionCount ? ` (${selectionCount})` : ""}` },
              { value: "page", label: "Page" },
              { value: "document", label: "All pages" },
            ]}
          />
          <Button
            variant={usages && !stale ? "secondary" : "primary"}
            className="ml-auto"
            loading={status === "scanning"}
            disabled={busy || (scope === "selection" && selectionCount === 0)}
            onClick={() => scan()}
          >
            {usages && !stale ? "Rescan" : "Scan fonts"}
          </Button>
        </div>
        {scope === "selection" && selectionCount === 0 && (
          <p className="text-xs text-fg-secondary">Select layers on the canvas to scan a selection.</p>
        )}
        {stale && (
          <p className="text-xs text-fg-warning">The scope changed. Scan again to update the list.</p>
        )}
        <Checkbox
          id="include-hidden"
          label="Include hidden layers"
          checked={includeHidden}
          disabled={busy}
          onChange={setIncludeHidden}
        />
      </header>

      {/* Body */}
      <main className="min-h-0 flex-1 overflow-y-auto" aria-busy={busy}>
        {status === "loading" && (
          <CenterMessage>
            <Spinner /> Loading available fonts
          </CenterMessage>
        )}

        {status === "idle" && !usages && (
          <CenterMessage>
            <span className="font-medium text-fg">Find and replace fonts</span>
            <span>Select a scope, then scan to list every font in use.</span>
          </CenterMessage>
        )}

        {status === "scanning" && (
          <div className="p-3">
            {progress ? (
              <ProgressBar label="Scanning text layers" done={progress.done} total={progress.total} />
            ) : (
              <CenterMessage>
                <Spinner /> Scanning text layers
              </CenterMessage>
            )}
          </div>
        )}

        {status === "error" && (
          <div role="alert" className="m-3 rounded border border-border bg-bg-danger p-2.5 text-sm text-fg-danger">
            <p className="font-medium">Something went wrong</p>
            <p className="mt-0.5 break-words">{error}</p>
            <Button size="sm" className="mt-2" onClick={() => scan()}>
              Try again
            </Button>
          </div>
        )}

        {usages && status !== "scanning" && status !== "loading" && (
          <>
            <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-bg px-3 py-2">
              <p className="flex-1 text-xs text-fg-secondary" aria-live="polite">
                {usages.length} fonts in {textLayerCount.toLocaleString()} text layers
              </p>
              {missingCount > 0 && (
                <Badge variant="danger">
                  {missingCount} missing
                </Badge>
              )}
              <Checkbox id="missing-only" label="Missing only" checked={missingOnly} onChange={setMissingOnly} disabled={missingCount === 0} />
            </div>

            {groups.length === 0 ? (
              <CenterMessage>
                <span className="font-medium text-fg">No fonts found</span>
                <span>
                  {textLayerCount === 0 ? "This scope has no text layers." : "No font matches the current filter."}
                </span>
              </CenterMessage>
            ) : (
              groups.map((group) => (
                <FamilyGroup
                  key={group.family}
                  family={group.family}
                  rows={group.rows}
                  families={families}
                  targetFamily={mapping.familyTargets[group.family] ?? null}
                  targetStyles={fontIndex.get(mapping.familyTargets[group.family] ?? "") ?? []}
                  disabled={busy}
                  onTargetFamily={onTargetFamily}
                  onTargetStyle={onTargetStyle}
                  onLocate={onLocate}
                />
              ))
            )}
          </>
        )}
      </main>

      {/* Footer: presets, options, replace */}
      {usages && usages.length > 0 && (
        <footer className="border-t border-border bg-bg">
          {result && status === "done" ? (
            <ResultReport result={result} onLocate={onLocate} onDismiss={() => setStatus("ready")} />
          ) : (
            <div className="space-y-2.5 px-3 py-2.5">
              <PresetBar
                presets={presets}
                canSave={Object.keys(mapping.familyTargets).length > 0}
                disabled={busy}
                onApply={onApplyPreset}
                onSave={onSavePreset}
                onDelete={(id) => send({ type: "delete-preset", id })}
              />
              <div className="grid grid-cols-2 gap-2">
                <Checkbox id="skip-locked" label="Skip locked layers" checked={skipLocked} disabled={busy} onChange={setSkipLocked} />
                <Checkbox
                  id="update-styles"
                  label="Update text styles"
                  description="Local styles only"
                  checked={updateTextStyles}
                  disabled={busy}
                  onChange={setUpdateTextStyles}
                />
              </div>
              {status === "replacing" && progress && (
                <ProgressBar label="Replacing fonts" done={progress.done} total={progress.total} />
              )}
              <div className="flex items-center gap-2">
                <p className="flex-1 text-xs text-fg-secondary">
                  {mappings.length === 0
                    ? "Pick a replacement family to start."
                    : `${mappings.length} fonts mapped, ${affectedLayers.toLocaleString()} layers affected`}
                </p>
                <Button
                  variant="ghost"
                  disabled={busy || Object.keys(mapping.familyTargets).length === 0}
                  onClick={() => setMapping(EMPTY_STATE)}
                >
                  Reset
                </Button>
                <Button
                  variant="primary"
                  loading={status === "replacing"}
                  disabled={busy || mappings.length === 0 || stale}
                  onClick={replace}
                >
                  Replace fonts
                </Button>
              </div>
            </div>
          )}
        </footer>
      )}
    </div>
  );
}

function CenterMessage({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full min-h-40 flex-col items-center justify-center gap-1 px-6 text-center text-sm text-fg-secondary">
      {children}
    </div>
  );
}
