"use client";

import { useId, type ComponentPropsWithRef, type ReactNode } from "react";

import { cn } from "./cn";

export type TextareaProps = Omit<ComponentPropsWithRef<"textarea">, "id"> & {
  /** Real `<label for>`, never a placeholder (WCAG 3.3.2). */
  label: ReactNode;
  /** Persistent helper text, announced with the field. */
  hint?: ReactNode;
  /** Error message; also flips the field to `aria-invalid`. */
  error?: string | null;
};

/**
 * Labelled multi-line field (refusal note, appointment report…).
 *
 * Same contract as `Field`: a real label, hint and error wired with
 * `aria-describedby`, and a visible focus ring inherited from the global style.
 */
export function Textarea({ label, hint, error, className, rows = 3, ...props }: TextareaProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ");

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>
      <textarea
        id={id}
        rows={rows}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        className={cn(
          "w-full rounded-md border bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-subtle",
          "transition-[border-color] duration-150 ease-standard hover:border-ink-subtle",
          "disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-ink-subtle",
          error ? "border-ink" : "border-line-strong",
        )}
        {...props}
      />
      {hint ? (
        <p id={hintId} className="text-xs text-ink-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-xs font-medium text-ink">
          {error}
        </p>
      ) : null}
    </div>
  );
}
