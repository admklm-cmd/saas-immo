"use client";

import { useId, type InputHTMLAttributes, type ReactNode } from "react";

import { cn } from "./cn";

export type FieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "id"> & {
  label: ReactNode;
  /** Persistent helper text, announced with the field. */
  hint?: ReactNode;
  /** Error message; also flips the field to `aria-invalid`. */
  error?: string | null;
};

/**
 * Labelled text input. The label is always a real `<label for>`, never a
 * placeholder (WCAG 3.3.2).
 */
export function Field({ label, hint, error, className, ...props }: FieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ");

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        className={cn(
          "h-11 w-full rounded-md border bg-surface px-3.5 text-sm text-ink placeholder:text-ink-subtle",
          "transition-[border-color,box-shadow] duration-150 ease-standard",
          "hover:border-ink-subtle disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-ink-subtle",
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
