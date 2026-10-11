import Link from "next/link";

import { formatDateTime } from "@/components/format";
import { APP_TEXTS } from "@/components/texts";
import { CONTACT_SOURCE_LABELS } from "@/features/contacts/types";

import type { DashboardInboundLeadItem } from "../types";
import { ITEM_LINK_CLASS } from "./link-styles";

const TEXTS = APP_TEXTS.dashboard;

/**
 * A lead Léa has not processed yet. It has no contact file: it links to the
 * inbox. The prospect's own words are deliberately NOT shown here.
 */
export function InboundLeadItem({ item }: { item: DashboardInboundLeadItem }) {
  return (
    <div className="min-w-0">
      <Link href="/agents-ia/leads-entrants" className={ITEM_LINK_CLASS}>
        {TEXTS.leadItem(CONTACT_SOURCE_LABELS[item.source])}
      </Link>
      <p className="mt-1 text-xs text-ink-muted">{TEXTS.receivedAt(formatDateTime(item.createdAt))}</p>
    </div>
  );
}
