// Small primitives in the shadcn/ui pattern: variant maps plus a cn() helper.
import { forwardRef } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

// ---------- Button ----------

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md";

const buttonVariants: Record<ButtonVariant, string> = {
  primary: "bg-bg-action text-fg-onbrand hover:bg-bg-action-hover",
  secondary: "border border-border bg-bg text-fg hover:bg-bg-hover",
  ghost: "text-fg-secondary hover:bg-bg-hover hover:text-fg",
  danger: "text-fg-danger hover:bg-bg-danger",
};

const buttonSizes: Record<ButtonSize, string> = {
  sm: "h-6 px-2 text-xs",
  md: "h-8 px-3 text-sm",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", loading = false, disabled, className, children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        buttonVariants[variant],
        buttonSizes[size],
        className,
      )}
      {...rest}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
});

export function Spinner() {
  return (
    <svg className="h-3 w-3 animate-spin" viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeOpacity="0.3" strokeWidth="2" />
      <path d="M14 8a6 6 0 0 0-6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

// ---------- Badge ----------

type BadgeVariant = "danger" | "warning" | "neutral" | "success";

const badgeVariants: Record<BadgeVariant, string> = {
  // Text uses the main text color: Figma danger, warning, and success text fail 4.5:1 on their tinted fills.
  danger: "bg-bg-danger text-fg",
  warning: "bg-bg-warning text-fg",
  success: "bg-bg-success text-fg",
  neutral: "bg-bg-secondary text-fg-secondary",
};

export function Badge({ variant = "neutral", children }: { variant?: BadgeVariant; children: ReactNode }) {
  return (
    <span className={cn("inline-flex h-4 items-center rounded px-1 text-xs font-medium", badgeVariants[variant])}>
      {children}
    </span>
  );
}

// ---------- Checkbox ----------

export interface CheckboxProps {
  id: string;
  label: string;
  description?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}

export function Checkbox({ id, label, description, checked, disabled, onChange }: CheckboxProps) {
  return (
    <div className="flex items-start gap-2">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        aria-describedby={description ? `${id}-desc` : undefined}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-[var(--figma-color-bg-brand)]"
      />
      <label htmlFor={id} className="select-none text-sm leading-4">
        {label}
        {description && (
          <span id={`${id}-desc`} className="block text-xs text-fg-secondary">
            {description}
          </span>
        )}
      </label>
    </div>
  );
}

// ---------- Segmented control ----------

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  disabled?: boolean;
}

export interface SegmentedControlProps<T extends string> {
  label: string;
  value: T;
  options: Array<SegmentedOption<T>>;
  disabled?: boolean;
  onChange: (value: T) => void;
}

export function SegmentedControl<T extends string>({ label, value, options, disabled, onChange }: SegmentedControlProps<T>) {
  const enabled = options.filter((o) => !o.disabled);
  const move = (step: number) => {
    const index = enabled.findIndex((o) => o.value === value);
    const next = enabled[(index + step + enabled.length) % enabled.length];
    if (next) onChange(next.value);
  };
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex h-7 rounded border border-border bg-bg-secondary p-0.5"
      onKeyDown={(e) => {
        if (e.key === "ArrowRight" || e.key === "ArrowDown") {
          e.preventDefault();
          move(1);
        } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
          e.preventDefault();
          move(-1);
        }
      }}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            disabled={disabled || option.disabled}
            onClick={() => onChange(option.value)}
            className={cn(
              "rounded-sm px-2.5 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50",
              selected ? "bg-bg font-medium text-fg shadow-sm" : "text-fg-secondary hover:text-fg",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

// ---------- Progress bar ----------

export function ProgressBar({ label, done, total }: { label: string; done: number; total: number }) {
  const percent = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-fg-secondary">
        <span>{label}</span>
        <span className="tabular-nums">
          {done.toLocaleString()}/{total.toLocaleString()}
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        className="h-1 overflow-hidden rounded-full bg-bg-secondary"
      >
        <div className="h-full bg-bg-brand transition-[width]" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

// ---------- Icons ----------

export function Icon({ name }: { name: "chevron" | "target" | "close" | "warning" | "check" }) {
  const paths: Record<typeof name, string> = {
    chevron: "M4 6l4 4 4-4",
    target: "M8 2v3M8 11v3M2 8h3M11 8h3M8 5.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5z",
    close: "M4 4l8 8M12 4l-8 8",
    warning: "M8 2l6.5 11.5h-13L8 2zM8 6.5v3M8 11.5v.01",
    check: "M3.5 8.5l3 3 6-7",
  };
  return (
    <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 16 16" aria-hidden="true">
      <path d={paths[name]} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
