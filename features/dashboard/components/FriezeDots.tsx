import { cn } from "@/components/ui/cn";

import type { DashboardIndicator } from "../types";
import { friezeDots } from "./frieze";
import styles from "./PipelineFrieze.module.css";

export type FriezeDotsProps = {
  count: DashboardIndicator<number>;
  /** `default` grey dots, `outcome` ink dots (signed mandates), `lost` hollow dots. */
  tone?: "default" | "outcome" | "lost";
  /**
   * `column`: from 1280 px, a bar of dots that grows from the line upwards — ten
   * per column, then a new column — so its height IS the count; below, rows of ten.
   * `row`: wraps left to right.
   */
  layout?: "column" | "row";
  className?: string;
};

/**
 * One dot per dossier of a stage — the exact count drawn, never a proportion
 * or an estimate (capped at `FRIEZE_DOT_CAP`, and then said next to the figure).
 * Decorative: the figure written next to it is what is read.
 */
export function FriezeDots({ count, tone = "default", layout = "column", className }: FriezeDotsProps) {
  const { drawn } = friezeDots(count);

  return (
    <span
      aria-hidden="true"
      data-testid="frieze-dots"
      data-drawn={drawn}
      className={cn(
        styles.dots,
        "flex gap-1",
        layout === "column"
          ? "w-29 flex-wrap justify-end xl:h-[calc(var(--frieze-rows,10)*0.875rem)] xl:w-auto xl:flex-col-reverse xl:flex-wrap xl:content-center xl:justify-start xl:gap-1.5"
          : "flex-wrap",
        className,
      )}
    >
      {Array.from({ length: drawn }, (_, index) => (
        <span
          key={index}
          data-tone={tone}
          className={cn(
            styles.dot,
            "size-2 shrink-0 rounded-full",
            tone === "outcome" && "bg-ink",
            tone === "default" && "bg-ink-subtle/55",
            tone === "lost" && "border-[1.5px] border-ink-subtle/70",
          )}
        />
      ))}
    </span>
  );
}
