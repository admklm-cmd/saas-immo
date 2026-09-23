import { formatDateTime } from "@/components/format";
import { APP_TEXTS } from "@/components/texts";
import { Badge } from "@/components/ui/Badge";
import { SimulationBadge } from "@/components/ui/SimulationBadge";
import { CONSENT_CHANNEL_LABELS, MESSAGE_STATUS_LABELS } from "@/features/contacts/types";
import { AGENT_LABELS } from "@/lib/agents/messages";

import type { DashboardMessageItem } from "../types";
import { ContactLink } from "./ContactLink";

const TEXTS = APP_TEXTS.dashboard;

/** A draft of the « à valider » queue: who, which channel, where it stands. No message body here. */
export function MessageItem({ item }: { item: DashboardMessageItem }) {
  const author = item.createdByAgent ? TEXTS.preparedBy(AGENT_LABELS[item.createdByAgent]) : TEXTS.writtenByHuman;

  return (
    <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
      <div className="min-w-0">
        <ContactLink contactId={item.contactId} contactName={item.contactName} />
        <p className="mt-1 text-xs text-ink-muted">
          {CONSENT_CHANNEL_LABELS[item.channel]} · {author} · {formatDateTime(item.createdAt)}
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-1.5">
        <Badge tone={item.status === "approved" ? "outline" : "neutral"}>
          {item.status === "approved" ? TEXTS.approvedNotSent : MESSAGE_STATUS_LABELS[item.status]}
        </Badge>
        {item.isSimulation ? <SimulationBadge /> : null}
      </div>
    </div>
  );
}
