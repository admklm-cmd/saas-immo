import { cn } from "./cn";

export type SkeletonProps = {
  className?: string;
};

/**
 * Loading placeholder.
 *
 * Purely decorative: hidden from assistive technology, the surrounding
 * `loading.tsx` announces the loading state once via `aria-busy`.
 * The shimmer disappears under `prefers-reduced-motion` (see globals.css).
 */
export function Skeleton({ className }: SkeletonProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "block animate-shimmer rounded-sm bg-surface-sunken",
        "bg-[linear-gradient(90deg,var(--color-surface-sunken)_0%,var(--color-surface-muted)_50%,var(--color-surface-sunken)_100%)] bg-[length:200%_100%]",
        className,
      )}
    />
  );
}
