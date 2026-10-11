import { BRAND } from "@/components/brand";

import { cn } from "./cn";

/**
 * Symbol heights. Below `sm` (20 px) the teardrop counter-form of the A closes
 * and the mark stops reading as a letter — see docs/design-system.md, § marque.
 */
const SYMBOL_HEIGHTS = {
  sm: "h-5",
  md: "h-7",
  lg: "h-10",
} as const;

export type LogoSymbolSize = keyof typeof SYMBOL_HEIGHTS;

type LogoSymbolProps = {
  size?: LogoSymbolSize;
  /**
   * Accessible name of the mark. Defaults to the product name because a logo
   * carries the brand — it is not decorative. Pass `null` only when the name
   * is already written next to it (that is what `Logo` does).
   */
  label?: string | null;
  className?: string;
};

/**
 * The brand symbol, alone.
 *
 * The mark is painted with `currentColor` through the alpha of the master
 * artwork used as a CSS mask (`.brand-symbol`, app/globals.css). It therefore
 * inverts itself: black on a light surface, white inside `text-ink-inverse`,
 * with no second asset, no theme prop and no JavaScript.
 *
 * The day a vector master arrives, only `BRAND.symbol` and the URL inside
 * `.brand-symbol` change — this component and its call sites stay as they are.
 */
export function LogoSymbol({ size = "md", label = BRAND.name, className }: LogoSymbolProps) {
  const ariaProps =
    label === null ? ({ "aria-hidden": true } as const) : ({ role: "img", "aria-label": label } as const);

  return (
    <span
      {...ariaProps}
      className={cn("brand-symbol block shrink-0", SYMBOL_HEIGHTS[size], className)}
      style={{ aspectRatio: `${BRAND.symbol.width} / ${BRAND.symbol.height}` }}
    />
  );
}
