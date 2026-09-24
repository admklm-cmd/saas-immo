import { ArrowLeftIcon, ArrowRightIcon } from "@radix-ui/react-icons";
import type { CSSProperties, ComponentPropsWithRef, ReactNode } from "react";

import { cn } from "./cn";
import { ThreeDotLoader } from "./ThreeDotLoader";

/**
 * `primary`: black, the one main action of a zone. `accent`: cobalt, reserved
 * to the rare action that must stand out from a black one nearby (never a
 * destructive action). `secondary`: bordered, pearl on hover. `ghost`: text.
 */
export type ButtonVariant = "primary" | "accent" | "secondary" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";
/** Direction of the optional arrow: two stacked arrows swap on hover. */
export type ButtonArrow = "forward" | "back";

const BASE =
  "group/button ui-focus inline-flex items-center justify-center gap-2 rounded-full font-medium " +
  // --duration-press and --ease-standard: tokens, never literal values.
  // `translate` / `scale` are the individual transform properties of Tailwind
  // v4, and the magnetic pull uses `transform`: they compose, and only the
  // button moves — its neighbours never do (no layout shift).
  "transition-[background-color,color,border-color,box-shadow,translate,scale,transform] duration-(--duration-press) ease-standard " +
  // Disabled (and loading, which disables): no hover, no press, no effect.
  "disabled:pointer-events-none aria-disabled:pointer-events-none";

/**
 * Movement of an ENABLED button only: hover lifts by 2 px (hover-capable
 * pointers only — Tailwind v4 wraps `hover:` in `@media (hover: hover)`),
 * press sinks by 1 px. Every class is gated by `motion-safe:`. A disabled or
 * busy button does not even carry these classes.
 */
const MOTION = "motion-safe:hover:-translate-y-0.5 motion-safe:active:translate-y-px motion-safe:active:scale-[0.98]";

/** Dimmed only when truly unavailable: a button busy with a request stays fully legible. */
const DIMMED_WHEN_DISABLED = "disabled:opacity-40";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-inverse text-ink-inverse font-semibold shadow-subtle hover:bg-inverse-soft hover:shadow-raised",
  accent: "bg-accent text-white font-semibold shadow-subtle hover:bg-accent-strong hover:shadow-raised",
  secondary:
    "border border-line-strong bg-surface text-ink shadow-subtle hover:border-ink-subtle hover:bg-pearl-soft hover:shadow-raised",
  ghost: "text-ink-muted hover:bg-surface-sunken hover:text-ink",
};

/** Variants that carry the cursor-following border halo. */
const HALO: Record<ButtonVariant, boolean> = { primary: true, accent: true, secondary: true, ghost: false };

/** Variants whose label letters roll on hover. */
const LETTERS: Record<ButtonVariant, boolean> = { primary: true, accent: true, secondary: false, ghost: false };

const SIZES: Record<ButtonSize, string> = {
  sm: "h-8 px-3.5 text-sm",
  md: "h-10 px-5 text-sm",
  lg: "h-12 px-7 text-[0.9375rem]",
};

/**
 * Two stacked arrows: on hover the first leaves in its direction while the
 * second arrives behind it (`interactions.css`). Decorative (`aria-hidden`):
 * the label says where the control goes. Still when the control is inert.
 */
export function ButtonArrowGlyph({ direction, still = false }: { direction: ButtonArrow; still?: boolean }) {
  const Icon = direction === "back" ? ArrowLeftIcon : ArrowRightIcon;
  return (
    <span
      aria-hidden="true"
      data-testid="button-arrow"
      data-direction={direction}
      data-still={still || undefined}
      className={cn("ui-arrow", still && "[&>span:last-child]:hidden")}
    >
      <span>
        <Icon width="1em" height="1em" />
      </span>
      <span>
        <Icon width="1em" height="1em" />
      </span>
    </span>
  );
}

/**
 * The label split into letters that roll one after the other on hover
 * (`--letter-step`, ≤ 12 ms). The letters are `aria-hidden`; the control gets
 * the whole label as its accessible name (`aria-label`), so a screen reader
 * reads it once, as a word, never letter by letter.
 */
export function RollingLabel({ text }: { text: string }) {
  return (
    <span aria-hidden="true" className="ui-letters" data-testid="button-letters">
      {Array.from(text).map((letter, index) => (
        <span key={index} className="ui-letter" style={{ "--i": index } as CSSProperties}>
          {letter}
        </span>
      ))}
    </span>
  );
}

export type ControlEffects = {
  /** Magnetic pull (3–5 px). Opt-in; never on a destructive or sensitive action. */
  magnetic?: boolean;
  /** Destructive action: no halo and no magnetic pull, ever. */
  destructive?: boolean;
  /** No motion and no effect (disabled, busy). */
  inert?: boolean;
};

/** Data attributes read by `PointerField` (halo and magnetic pull). */
export function controlEffectAttributes(
  variant: ButtonVariant,
  { magnetic = false, destructive = false, inert = false }: ControlEffects,
): Record<string, string | undefined> {
  return {
    // Never on a destructive control: no decorative pull towards a risky action.
    "data-pointer": HALO[variant] && !inert && !destructive ? "" : undefined,
    "data-magnetic": magnetic && !destructive && !inert ? "" : undefined,
    "data-destructive": destructive ? "" : undefined,
  };
}

/** Shared styles, so links that look like buttons stay perfectly consistent. */
export function buttonStyles(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  options: { still?: boolean; magnetic?: boolean } = {},
): string {
  return cn(
    BASE,
    !options.still && MOTION,
    !options.still && HALO[variant] && "ui-halo",
    !options.still && options.magnetic && "ui-magnetic",
    DIMMED_WHEN_DISABLED,
    VARIANTS[variant],
    SIZES[size],
  );
}

/** True when the label can be split into rolling letters. */
export function canRollLabel(variant: ButtonVariant, children: ReactNode): children is string {
  return LETTERS[variant] && typeof children === "string" && children.length > 0;
}

/** Label with its optional arrow, in reading order (← before, → after). */
export function withArrow(children: ReactNode, arrow: ButtonArrow | undefined, still: boolean): ReactNode {
  if (!arrow) return children;
  return arrow === "back" ? (
    <>
      <ButtonArrowGlyph direction="back" still={still} />
      {children}
    </>
  ) : (
    <>
      {children}
      <ButtonArrowGlyph direction="forward" still={still} />
    </>
  );
}

/** `ref` is a plain prop in React 19: it is forwarded by the spread below. */
export type ButtonProps = ComponentPropsWithRef<"button"> &
  Omit<ControlEffects, "inert"> & {
    variant?: ButtonVariant;
    size?: ButtonSize;
    /**
     * A real server action is in flight: shows the three-dot loader, sets
     * `aria-busy` and disables the button. The children should then carry
     * the text for what is happening (« Simulation en cours… »).
     */
    isLoading?: boolean;
    /** Optional arrow slot (two arrows that swap on hover; never when disabled). */
    arrow?: ButtonArrow;
  };

export function Button({
  variant = "primary",
  size = "md",
  isLoading = false,
  arrow,
  magnetic = false,
  destructive = false,
  className,
  disabled,
  children,
  type = "button",
  ...props
}: ButtonProps) {
  const inert = Boolean(disabled) || isLoading;
  const roll = !inert && canRollLabel(variant, children);
  const label = roll ? <RollingLabel text={children} /> : children;

  return (
    <button
      type={type}
      className={cn(
        BASE,
        !inert && MOTION,
        !inert && HALO[variant] && !destructive && "ui-halo",
        !inert && magnetic && !destructive && "ui-magnetic",
        !isLoading && DIMMED_WHEN_DISABLED,
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      disabled={inert}
      aria-busy={isLoading || undefined}
      aria-label={roll ? children : undefined}
      {...controlEffectAttributes(variant, { magnetic, destructive, inert })}
      {...props}
    >
      {isLoading ? <ThreeDotLoader size="sm" /> : null}
      {arrow ? (
        <span className="inline-flex items-center gap-1.5">{withArrow(label, arrow, inert)}</span>
      ) : (
        <span className="inline-flex">{label}</span>
      )}
    </button>
  );
}
