// Family picker. WAI-ARIA combobox pattern (list autocomplete, manual selection).
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { searchFamilies } from "../../shared/fontMatch";
import { cn, Icon } from "./primitives";

export interface FontComboboxProps {
  /** Accessible name, for example "Target family for Inter". */
  label: string;
  families: string[];
  value: string | null;
  placeholder?: string;
  disabled?: boolean;
  onChange: (family: string | null) => void;
}

export function FontCombobox({ label, families, value, placeholder = "Select font", disabled, onChange }: FontComboboxProps) {
  const id = useId();
  const listId = `${id}-list`;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const results = useMemo(() => searchFamilies(families, query), [families, query]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) close();
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const option = listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`);
    option?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  function openList() {
    if (disabled) return;
    setQuery("");
    const index = value ? families.indexOf(value) : -1;
    setActive(index >= 0 && index < 80 ? index : 0);
    setOpen(true);
  }

  function close() {
    setOpen(false);
    setQuery("");
  }

  function commit(family: string) {
    onChange(family);
    close();
    inputRef.current?.focus();
  }

  const activeId = open && results[active] ? `${id}-opt-${active}` : undefined;

  return (
    <div ref={rootRef} className="relative min-w-0 flex-1">
      <div className="relative">
        <input
          ref={inputRef}
          role="combobox"
          aria-label={label}
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={activeId}
          disabled={disabled}
          className={cn("field pr-12", value && !open ? "font-medium" : "")}
          placeholder={placeholder}
          value={open ? query : (value ?? "")}
          onFocus={() => !open && openList()}
          onClick={() => !open && openList()}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
            if (!open) setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              if (!open) openList();
              else setActive((i) => Math.min(i + 1, results.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((i) => Math.max(i - 1, 0));
            } else if (e.key === "Home" && open) {
              e.preventDefault();
              setActive(0);
            } else if (e.key === "End" && open) {
              e.preventDefault();
              setActive(results.length - 1);
            } else if (e.key === "Enter") {
              if (open && results[active]) {
                e.preventDefault();
                commit(results[active]);
              }
            } else if (e.key === "Escape") {
              if (open) {
                e.preventDefault();
                e.stopPropagation();
                close();
              }
            } else if (e.key === "Tab") {
              close();
            }
          }}
        />
        <div className="absolute inset-y-0 right-1 flex items-center gap-0.5">
          {value && !disabled && (
            <button
              type="button"
              aria-label={`Clear ${label}`}
              className="rounded p-0.5 text-fg-tertiary hover:bg-bg-hover hover:text-fg"
              onClick={() => {
                onChange(null);
                close();
              }}
            >
              <Icon name="close" />
            </button>
          )}
          <span className="pointer-events-none text-fg-tertiary">
            <Icon name="chevron" />
          </span>
        </div>
      </div>

      {open && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label={label}
          className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded border border-border bg-bg py-1 shadow-lg"
        >
          {results.length === 0 ? (
            <li className="px-2 py-1.5 text-sm text-fg-secondary" role="presentation">
              No fonts match "{query}"
            </li>
          ) : (
            results.map((family, index) => (
              <li
                key={family}
                id={`${id}-opt-${index}`}
                data-index={index}
                role="option"
                aria-selected={family === value}
                className={cn(
                  "flex cursor-default items-center justify-between px-2 py-1 text-sm",
                  index === active ? "bg-bg-selected" : "",
                )}
                onPointerMove={() => setActive(index)}
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => commit(family)}
              >
                <span className="truncate">{family}</span>
                {family === value && (
                  <span className="text-fg-brand">
                    <Icon name="check" />
                  </span>
                )}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
