// Apply, save, and delete mapping presets. Presets live in figma.clientStorage.
import { useState } from "react";
import type { Preset } from "../../shared/types";
import { Button } from "./primitives";

export interface PresetBarProps {
  presets: Preset[];
  canSave: boolean;
  disabled: boolean;
  onApply: (preset: Preset) => void;
  onSave: (name: string) => void;
  onDelete: (id: string) => void;
}

export function PresetBar({ presets, canSave, disabled, onApply, onSave, onDelete }: PresetBarProps) {
  const [selectedId, setSelectedId] = useState("");
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const selected = presets.find((p) => p.id === selectedId);

  if (saving) {
    const trimmed = name.trim();
    return (
      <form
        className="flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!trimmed) return;
          onSave(trimmed);
          setSaving(false);
          setName("");
        }}
      >
        <input
          autoFocus
          aria-label="Preset name"
          className="field flex-1"
          placeholder="Preset name, for example Inter to Geist"
          value={name}
          maxLength={60}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.stopPropagation();
              setSaving(false);
            }
          }}
        />
        <Button type="submit" size="sm" variant="primary" disabled={!trimmed}>
          Save
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setSaving(false)}>
          Cancel
        </Button>
      </form>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <select
        aria-label="Preset"
        className="field flex-1"
        value={selectedId}
        disabled={disabled || presets.length === 0}
        onChange={(e) => setSelectedId(e.target.value)}
      >
        <option value="">{presets.length === 0 ? "No saved presets" : "Select a preset"}</option>
        {presets.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <Button size="sm" disabled={disabled || !selected} onClick={() => selected && onApply(selected)}>
        Apply
      </Button>
      {selected ? (
        <Button
          size="sm"
          variant="danger"
          disabled={disabled}
          aria-label={`Delete preset ${selected.name}`}
          onClick={() => {
            onDelete(selected.id);
            setSelectedId("");
          }}
        >
          Delete
        </Button>
      ) : (
        <Button size="sm" variant="ghost" disabled={disabled || !canSave} onClick={() => setSaving(true)}>
          Save current
        </Button>
      )}
    </div>
  );
}
