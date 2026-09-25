import { APP_TEXTS } from "@/components/texts";
import { cn } from "@/components/ui/cn";
import { Glyph } from "@/features/agents-ia/components/icons/Glyph";
import type { ContactListItem } from "@/features/contacts/types";

const TEXTS = APP_TEXTS.contacts;

export type ContactStateMarksProps = {
  contact: Pick<ContactListItem, "humanTakeover" | "openTasksCount">;
  /**
   * `labelled`: the shape then the words (pipeline cards, one per line of
   * thought). `compact`: the shape and the figure only, the words for screen
   * readers and as a tooltip (a table row stays on one line).
   */
  variant?: "labelled" | "compact";
  className?: string;
};

/**
 * The two real states of a file that a list must show at a glance, drawn with
 * the glyph family (docs/design-system.md §2.8) rather than with more text:
 *   * taken over by an advisor — the human shape (circle, double contour):
 *     a person holds the file, the AI follow-ups are stopped;
 *   * open tasks — the task glyph and their exact number.
 * Nothing is rendered when neither applies.
 */
export function ContactStateMarks({ contact, variant = "labelled", className }: ContactStateMarksProps) {
  const takeover = contact.humanTakeover;
  const tasks = contact.openTasksCount;
  if (!takeover && tasks <= 0) return null;

  const compact = variant === "compact";

  return (
    <span className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 text-xs", className)}>
      {takeover ? (
        <span
          data-mark="human-takeover"
          title={compact ? TEXTS.humanTakeover : undefined}
          className="inline-flex items-center gap-1.5 font-medium whitespace-nowrap text-ink"
        >
          <span
            aria-hidden="true"
            className="inline-grid size-4.5 shrink-0 place-items-center rounded-full bg-surface text-ink shadow-[inset_0_0_0_1.25px_var(--color-ink)] outline-1 outline-offset-[1.5px] outline-ink-subtle outline-solid"
          >
            <Glyph name="human" width={10} />
          </span>
          <span className={compact ? "sr-only" : undefined}>{TEXTS.humanTakeover}</span>
        </span>
      ) : null}
      {tasks > 0 ? (
        <span
          data-mark="open-tasks"
          title={compact ? TEXTS.openTasks(tasks) : undefined}
          className="inline-flex items-center gap-1 whitespace-nowrap text-ink-muted"
        >
          <Glyph name="tasks" width={14} className="shrink-0" />
          {compact ? (
            <>
              <span aria-hidden="true" className="font-medium tabular-nums">
                {tasks}
              </span>
              <span className="sr-only">{TEXTS.openTasks(tasks)}</span>
            </>
          ) : (
            <span>{TEXTS.openTasks(tasks)}</span>
          )}
        </span>
      ) : null}
    </span>
  );
}
