import { formatDateTime } from "@/components/format";
import { APP_TEXTS } from "@/components/texts";
import { AGENT_LABELS } from "@/lib/agents/messages";

import type { DashboardTaskItem } from "../types";
import { ContactLink } from "./ContactLink";

const TEXTS = APP_TEXTS.dashboard;

/** An open task: linked to its contact file, or plainly marked as an agency-level task. */
export function TaskItem({ item }: { item: DashboardTaskItem }) {
  const details = [
    item.dueAt ? TEXTS.dueAt(formatDateTime(item.dueAt)) : TEXTS.noDueDate,
    item.createdByAgent ? TEXTS.openedBy(AGENT_LABELS[item.createdByAgent]) : null,
  ].filter((part): part is string => part !== null);

  return (
    <div className="min-w-0">
      <p className="text-sm font-medium break-words text-ink">{item.title}</p>
      <p className="mt-1 text-sm">
        {item.contactId && item.contactName ? (
          <ContactLink contactId={item.contactId} contactName={item.contactName} />
        ) : (
          <span className="text-ink-subtle">{TEXTS.agencyTask}</span>
        )}
      </p>
      <p className="mt-1 text-xs text-ink-muted">{details.join(" · ")}</p>
    </div>
  );
}
