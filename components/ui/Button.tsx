import type { ComponentPropsWithRef } from "react";

import { cn } from "./cn";
import { MotionDots } from "./MotionDots";

export type ButtonVariant = "primary" | "secondary" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

const BASE =
  "motion-button inline-flex items-center justify-center gap-2 rounded-full font-medium " +
  // duration-150 == --duration-fast (see docs/design-system.md: Tailwind v4 has
  // no `--duration-*` theme namespace, the numeric utility is the token value).
  "transition-[background-color,color,border-color,transform,box-shadow] duration-150 ease-standard " +
  "active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-inverse text-ink-inverse shadow-subtle hover:bg-inverse-soft",
  secondary:
    "border border-line-strong bg-surface text-ink shadow-subtle hover:bg-surface-sunken hover:border-ink-subtle",
  ghost: "text-ink-muted hover:bg-surface-sunken hover:text-ink",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "h-8 px-3.5 text-[0.8125rem]",
  md: "h-10 px-5 text-sm",
  lg: "h-12 px-7 text-[0.9375rem]",
};

/** Shared styles, so links that look like buttons stay perfectly consistent. */
export function buttonStyles(variant: ButtonVariant = "primary", size: ButtonSize = "md"): string {
  return cn(BASE, VARIANTS[variant], SIZES[size]);
}

/** `ref` is a plain prop in React 19: it is forwarded by the spread below. */
export type ButtonProps = ComponentPropsWithRef<"button"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Shows a spinner, disables the button and announces the busy state. */
  isLoading?: boolean;
};

export function Button({
  variant = "primary",
  size = "md",
  isLoading = false,
  className,
  disabled,
  children,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(buttonStyles(variant, size), className)}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      {...props}
    >
      {isLoading ? (
        <MotionDots />
      ) : null}
      <span>{children}</span>
    </button>
  );
}
