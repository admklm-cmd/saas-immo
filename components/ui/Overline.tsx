import { cn } from "./cn";

export type OverlineProps = {
  /** Stored in normal case: the capitals come from `.label-mono`. */
  children: string;
  as?: "p" | "span";
  className?: string;
};

/**
 * Mono overline preceded by a 12 × 2 px cobalt dash (docs/design-system.md
 * §2.2.6). The dash is a pseudo-element: nothing extra is read by a screen
 * reader. Always placed OUTSIDE the heading it introduces, so it never enters
 * the heading's accessible name.
 */
export function Overline({ children, as: Tag = "p", className }: OverlineProps) {
  return (
    <Tag
      className={cn(
        "label-mono inline-flex items-center gap-2.5 before:h-0.5 before:w-3 before:flex-none before:bg-accent before:content-['']",
        className,
      )}
      data-testid="overline"
    >
      {children}
    </Tag>
  );
}
