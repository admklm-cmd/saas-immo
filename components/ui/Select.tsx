import type { ComponentPropsWithRef, ReactNode } from "react";

import { cn } from "./cn";

export type SelectOption = { value: string; label: string };

export type SelectProps = Omit<ComponentPropsWithRef<"select">, "children"> & {
  /** Real `<label for>`, never a placeholder option (WCAG 3.3.2). */
  label: ReactNode;
  /** Required and explicit so the field works in a Server Component. */
  id: string;
  options: readonly SelectOption[];
};

/**
 * Labelled dropdown.
 *
 * Deliberately a native `<select>`: full keyboard support, native mobile
 * pickers and no dependency — the design system has no custom listbox and does
 * not need one.
 */
export function Select({ label, id, options, className, ...props }: SelectProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>
      <select
        id={id}
        className={cn(
          "h-11 w-full rounded-md border border-line-strong bg-surface px-3 text-sm text-ink",
          "transition-[border-color] duration-150 ease-standard hover:border-ink-subtle",
          "disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-ink-subtle",
        )}
        {...props}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
