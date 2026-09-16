import type { ReactNode } from "react";

import { cn } from "./cn";

export type BadgeTone = "neutral" | "outline" | "solid" | "dashed";

const TONES: Record<BadgeTone, string> = {
  /** Default: quiet grey chip. */
  neutral: "bg-surface-sunken text-ink-muted",
  /** Outlined: same weight as neutral, used to separate two adjacent chips. */
  outline: "border border-line-strong bg-surface text-ink-muted",
  /** Strongest emphasis available without using colour. */
  solid: "bg-inverse text-ink-inverse",
  /** Something is missing or not yet acquired. */
  dashed: "border border-dashed border-line-strong bg-surface text-ink-subtle",
};

export type BadgeProps = {
  children: ReactNode;
  tone?: BadgeTone;
  /** Small leading glyph (already decorative: always aria-hidden). */
  icon?: ReactNode;
  className?: string;
  title?: string;
};

export function Badge({ children, tone = "neutral", icon, className, title }: BadgeProps) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap",
        TONES[tone],
        className,
      )}
    >
      {icon ? <span aria-hidden="true">{icon}</span> : null}
      {children}
    </span>
  );
}
