import type { ReactNode } from "react";

import { cn } from "@/components/ui/cn";

import { AgentAppIcon } from "../icons/AgentAppIcon";
import type { GlyphName } from "../icons/glyphs";

export type RuleNoteProps = {
  /** The rule, in one sentence (« Premier contact : toujours validé par un humain »). */
  title: ReactNode;
  children?: ReactNode;
  /** Who the rule protects the decision of: a person (default) or the agency's system. */
  glyph?: GlyphName;
  kind?: "human" | "neutral";
  className?: string;
  testId?: string;
};

/**
 * A product rule, said ONCE per work screen, at the place where it applies
 * (docs/design-system.md §3.1.3) — never repeated under every card.
 *
 * Quieter than an `Alert`: the rule is not an event, it is the frame of the
 * screen. The human shape (double contour) says who holds the decision; the
 * words are unchanged, never shortened (they are guard rails).
 */
export function RuleNote({ title, children, glyph = "human", kind = "human", className, testId }: RuleNoteProps) {
  return (
    <div data-testid={testId} className={cn("flex items-start gap-3.5", className)}>
      <AgentAppIcon glyph={glyph} kind={kind} size="sm" className="mt-0.5 shrink-0" />
      <div className="min-w-0 text-sm">
        <p className="font-semibold text-ink">{title}</p>
        {children ? <div className="mt-1 max-w-3xl text-pretty text-ink-muted">{children}</div> : null}
      </div>
    </div>
  );
}
