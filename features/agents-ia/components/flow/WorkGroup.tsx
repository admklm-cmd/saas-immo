import { useId, type ReactNode } from "react";

import { cn } from "@/components/ui/cn";

export type WorkGroupProps = {
  /** « Prêts », « Bloqués », a motive… */
  title: ReactNode;
  /** Exact count of the items of the group, already worded (« 4 dossiers »). */
  count?: ReactNode;
  /** One short line under the title: the rule that applies to the whole group. */
  note?: ReactNode;
  /** Right side of the heading (a link to the screen where the group is handled). */
  action?: ReactNode;
  /** Anchor, so a summary can link to the group. */
  anchor?: string;
  level?: 2 | 3;
  /** `lead`: a first-level group. `sub`: a motive inside a group. */
  tone?: "lead" | "sub";
  children: ReactNode;
  className?: string;
  /** Band styling of the heading when the group lives inside a list card. */
  headerClassName?: string;
  testId?: string;
};

/**
 * A group of a work screen (docs/design-system.md §3.1.3): items that share the
 * same state are gathered under ONE heading that says the state and its exact
 * count, so the state is written once instead of on every item.
 */
export function WorkGroup({
  title,
  count,
  note,
  action,
  anchor,
  level = 2,
  tone = "lead",
  children,
  className,
  headerClassName,
  testId,
}: WorkGroupProps) {
  const headingId = useId();
  const Heading = level === 2 ? "h2" : "h3";

  return (
    <section
      id={anchor}
      aria-labelledby={headingId}
      data-testid={testId}
      className={cn("scroll-mt-24", className)}
    >
      <header className={cn("flex flex-wrap items-end justify-between gap-x-6 gap-y-2", headerClassName)}>
        <div className="particle-veil min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <Heading
              id={headingId}
              className={cn(
                "text-ink",
                tone === "lead" ? "text-section font-semibold" : "text-base font-semibold",
              )}
            >
              {title}
            </Heading>
            {count ? (
              <span className={cn("text-ink-subtle", tone === "lead" ? "text-sm" : "text-xs")}>{count}</span>
            ) : null}
          </div>
          {note ? <p className="mt-1 max-w-2xl text-xs text-pretty text-ink-muted">{note}</p> : null}
        </div>
        {action ? <div className="flex shrink-0 items-center">{action}</div> : null}
      </header>
      {children}
    </section>
  );
}
