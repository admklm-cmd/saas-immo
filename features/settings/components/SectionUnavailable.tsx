import { APP_TEXTS } from "@/components/texts";
import { ButtonLink } from "@/components/ui/ButtonLink";

const TEXTS = APP_TEXTS.settings;

/**
 * A settings section whose read failed. It says « Indisponible » — never an
 * empty value, never a guess — and never hides the other sections.
 */
export function SectionUnavailable() {
  return (
    <div data-status="unavailable">
      <p className="text-sm font-semibold text-ink">{TEXTS.unavailable}</p>
      <p className="mt-1 text-xs text-ink-muted">{TEXTS.unavailableHint}</p>
      <ButtonLink href="/parametres" variant="secondary" size="sm" className="mt-4">
        {APP_TEXTS.states.retry}
      </ButtonLink>
    </div>
  );
}
