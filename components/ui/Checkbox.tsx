"use client";

import { useId, type ReactNode } from "react";

import { cn } from "./cn";

export type CheckboxProps = {
  /** The whole sentence the user agrees with: it is the real `<label>`. */
  label: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  testId?: string;
};

/**
 * Explicit confirmation box (signed mandate, exit from a signed mandate…).
 *
 * Controlled and **never pre-ticked** by this component: the parent starts at
 * `false` and only a user action flips it. The whole bordered area is the
 * label, so the hit target stays comfortable on a phone.
 */
export function Checkbox({ label, checked, onChange, disabled, testId }: CheckboxProps) {
  const id = useId();

  return (
    <label
      htmlFor={id}
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-lg border bg-surface p-4 text-sm leading-relaxed text-ink",
        "transition-[border-color,background-color] duration-150 ease-standard hover:border-ink-subtle",
        // Never colour alone: a ticked box also thickens the frame.
        checked ? "border-ink bg-surface-muted" : "border-line-strong",
        disabled && "cursor-not-allowed opacity-60",
      )}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 size-[18px] shrink-0 accent-inverse"
        data-testid={testId}
      />
      <span className="font-medium">{label}</span>
    </label>
  );
}
