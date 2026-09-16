import { APP_TEXTS } from "@/components/texts";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { EmptyState } from "@/components/ui/EmptyState";

/** Root 404 page. */
export default function NotFound() {
  return (
    <main id="content" className="mx-auto flex w-full max-w-2xl flex-1 items-center px-6 py-24">
      <EmptyState
        className="w-full"
        title={APP_TEXTS.states.notFoundTitle}
        description={APP_TEXTS.states.notFoundBody}
        action={
          <ButtonLink href="/" variant="secondary">
            {APP_TEXTS.brand.name}
          </ButtonLink>
        }
      />
    </main>
  );
}
