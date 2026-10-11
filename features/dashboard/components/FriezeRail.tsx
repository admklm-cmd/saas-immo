import type { ReactNode } from "react";

import { cn } from "@/components/ui/cn";

export type FriezeRailProps = {
  /** The node drawn on the line (a stage dot, a checkpoint, the mandate). */
  children: ReactNode;
  /** First or last step: the line starts or stops at the node. */
  first?: boolean;
  last?: boolean;
};

/**
 * The segment of the pipeline line under one step, and its node. Each step
 * draws its own segment, so the line is continuous whatever the widths:
 * vertical on the left below 1280 px, horizontal from 1280 px.
 */
export function FriezeRail({ children, first = false, last = false }: FriezeRailProps) {
  return (
    <div
      aria-hidden="true"
      className="relative order-1 flex w-8 shrink-0 items-center justify-center self-stretch xl:order-2 xl:h-8 xl:w-full xl:self-auto"
    >
      <span
        className={cn(
          "absolute left-1/2 w-px -translate-x-1/2 bg-line-strong xl:hidden",
          first ? "top-1/2" : "top-0",
          last ? "bottom-1/2" : "bottom-0",
        )}
      />
      <span
        className={cn(
          "absolute top-1/2 hidden h-px -translate-y-1/2 bg-line-strong xl:block",
          first ? "left-1/2" : "left-0",
          last ? "right-1/2" : "right-0",
        )}
      />
      <span className="relative flex items-center justify-center">{children}</span>
    </div>
  );
}
