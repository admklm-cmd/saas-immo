import type { ComponentPropsWithRef } from "react";

import { cn } from "./cn";
import { ThreeDotLoader } from "./ThreeDotLoader";

export type ButtonVariant = "primary" | "secondary" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-full font-medium " +
  // duration-150 == --duration-fast (see docs/design-system.md: Tailwind v4 has
  // no `--duration-*` theme namespace, the numeric utility is the token value).
  // `translate` / `scale` are the individual transform properties of Tailwind
  // v4: only the button moves, its neighbours never do.
  "transition-[background-color,color,border-color,box-shadow,translate,scale] duration-150 ease-standard " +
  // Hover lifts by 2 px (hover-capable pointers only), press sinks by 1 px and
  // scales to .97. Nothing moves with prefers-reduced-motion.
  "motion-safe:hover:-translate-y-0.5 motion-safe:active:translate-y-px motion-safe:active:scale-[0.97] " +
  // Disabled (and loading, which disables): no hover, no press, no movement.
  "disabled:pointer-events-none aria-disabled:pointer-events-none";

/** Dimmed only when truly unavailable: a button busy with a request stays fully legible. */
const DIMMED_WHEN_DISABLED = "disabled:opacity-40";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-inverse text-ink-inverse shadow-subtle hover:bg-inverse-soft hover:shadow-raised",
  secondary:
    "border border-line-strong bg-surface text-ink shadow-subtle hover:bg-surface-sunken hover:border-ink-subtle hover:shadow-raised",
  ghost: "text-ink-muted hover:bg-surface-sunken hover:text-ink",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "h-8 px-3.5 text-[0.8125rem]",
  md: "h-10 px-5 text-sm",
  lg: "h-12 px-7 text-[0.9375rem]",
};

/** Shared styles, so links that look like buttons stay perfectly consistent. */
export function buttonStyles(variant: ButtonVariant = "primary", size: ButtonSize = "md"): string {
  return cn(BASE, DIMMED_WHEN_DISABLED, VARIANTS[variant], SIZES[size]);
}

/** `ref` is a plain prop in React 19: it is forwarded by the spread below. */
export type ButtonProps = ComponentPropsWithRef<"button"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /**
   * A real request is in flight: shows the compact `ThreeDotLoader`, disables
   * the button (no double submission) and sets `aria-busy`. The caller swaps
   * the text for what is happening (« Simulation en cours… »).
   */
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
      className={cn(BASE, !isLoading && DIMMED_WHEN_DISABLED, VARIANTS[variant], SIZES[size], className)}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      {...props}
    >
      {isLoading ? <ThreeDotLoader size="sm" /> : null}
      <span>{children}</span>
    </button>
  );
}
