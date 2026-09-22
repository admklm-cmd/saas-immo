import type { ReactNode } from "react";

import { APP_TEXTS } from "@/components/texts";

const TEXTS = APP_TEXTS.estimation;

export type EstimationRequiredLabelProps = { children: ReactNode };

/**
 * Label of a required field of `/estimation`.
 *
 * The `required` attribute alone is only announced to screen readers: a
 * sighted visitor would have nothing to go on (WCAG 3.3.2). The marker is
 * therefore part of the visible label text — never a colour, never an
 * unexplained asterisk — so both audiences get the same information.
 */
export function EstimationRequiredLabel({ children }: EstimationRequiredLabelProps) {
  return (
    <>
      {children}{" "}
      <span className="text-xs font-normal text-ink-subtle">{TEXTS.requiredMark}</span>
    </>
  );
}
