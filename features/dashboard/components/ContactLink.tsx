import Link from "next/link";

import { APP_TEXTS } from "@/components/texts";

import { ITEM_LINK_CLASS } from "./link-styles";

/**
 * The contact of a dashboard item, linked to its file. The visible name is
 * completed for screen readers so the link says where it goes.
 *
 * The id is a database uuid; it is still encoded as one path segment so a
 * malformed value can never change the target route (defence in depth).
 */
export function ContactLink({ contactId, contactName }: { contactId: string; contactName: string }) {
  return (
    <Link href={`/contacts/${encodeURIComponent(contactId)}`} className={ITEM_LINK_CLASS}>
      {contactName}
      <span className="sr-only"> — {APP_TEXTS.dashboard.openContact}</span>
    </Link>
  );
}
