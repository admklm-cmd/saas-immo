import { cn } from "./cn";

export type ThreeDotLoaderSize = "sm" | "md";

export type ThreeDotLoaderProps = {
  /** `sm` inside a button, `md` for a busy area. */
  size?: ThreeDotLoaderSize;
  /**
   * What is happening (« Chargement… », « Simulation en cours… »), written by
   * the caller. Without a label the dots are purely decorative: the caller
   * (a `Button` with `aria-busy` and its own text) already says it.
   */
  label?: string;
  className?: string;
};

/**
 * A REAL request is in flight: three balls 120° apart turning around a centre.
 *
 * Only ever rendered while an asynchronous operation is pending — it is
 * unmounted the instant the operation succeeds or fails, and never delayed.
 * With `prefers-reduced-motion`, the triangle stays still and the label keeps
 * saying what is happening.
 */
export function ThreeDotLoader({ size = "md", label, className }: ThreeDotLoaderProps) {
  const dots = (
    <span aria-hidden="true" className="dot-loader" data-size={size} data-testid="three-dot-loader">
      <i />
      <i />
      <i />
    </span>
  );

  if (!label) return dots;

  return (
    // `status` is announced once, when the loader appears; the label never
    // changes while it is shown, so nothing is repeated.
    <span role="status" className={cn("inline-flex items-center gap-2.5 text-sm text-ink-muted", className)}>
      {dots}
      <span>{label}</span>
    </span>
  );
}
