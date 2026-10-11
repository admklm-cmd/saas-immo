import { BRAND } from "@/components/brand";

import { cn } from "./cn";
import { LogoSymbol, type LogoSymbolSize } from "./LogoSymbol";

/**
 * The two documented lock-up sizes. `sm` sits in every fixed bar shipped today
 * (public header, signed-in column, sign-in header); `md` is reserved for the
 * calm, spacious compositions and has no call site yet. Anything larger would
 * be a third documented size, not an ad-hoc `className` at the call site.
 */
const LOCKUPS: Record<"sm" | "md", { symbol: LogoSymbolSize; text: string; gap: string }> = {
  sm: { symbol: "md", text: "text-xs", gap: "gap-2.5" },
  md: { symbol: "lg", text: "text-sm", gap: "gap-3" },
};

export type LogoSize = keyof typeof LOCKUPS;

/**
 * The full lock-up: the symbol, then the brand name set in two typographic
 * lines to its right. No image carries the words — they are live text, so they
 * stay sharp at any zoom and follow the interface font.
 *
 * Both halves take their colour from `currentColor`, so the lock-up inverts
 * itself on a dark surface exactly like the symbol does. It therefore sets NO
 * colour of its own: `--color-ink` on a light surface, `--color-ink-inverse`
 * inside an inverse panel. A `text-ink` here would paint it black on black.
 *
 * `role="img"` is not decoration here: without it, the accessible name would be
 * assembled from two separate lines and browsers disagree on whether they get a
 * space in between ("Ascend Strategy" or "AscendStrategy"). The label repeats
 * the visible text word for word (WCAG 2.5.3, label in name).
 */
export function Logo({ size = "sm", className }: { size?: LogoSize; className?: string }) {
  const lockup = LOCKUPS[size];

  return (
    <span
      role="img"
      aria-label={BRAND.name}
      className={cn("inline-flex items-center", lockup.gap, className)}
    >
      <LogoSymbol size={lockup.symbol} label={null} />
      <span
        aria-hidden="true"
        className={cn("flex flex-col font-semibold tracking-tight", lockup.text, "leading-tight")}
      >
        {BRAND.wordmark.map((line) => (
          <span key={line}>{line}</span>
        ))}
      </span>
    </span>
  );
}
