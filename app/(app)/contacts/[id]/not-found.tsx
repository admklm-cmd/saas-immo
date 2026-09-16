import { APP_TEXTS } from "@/components/texts";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { EmptyState } from "@/components/ui/EmptyState";

/**
 * Shown both when the contact does not exist and when it belongs to another
 * agency: the two cases are indistinguishable by design.
 */
export default function ContactNotFound() {
  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-20">
      <EmptyState
        title={APP_TEXTS.contact.notFoundTitle}
        description={APP_TEXTS.contact.notFoundBody}
        action={
          <ButtonLink href="/contacts" variant="secondary">
            {APP_TEXTS.contact.backToList}
          </ButtonLink>
        }
      />
    </div>
  );
}
