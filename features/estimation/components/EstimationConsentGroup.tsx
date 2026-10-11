import Link from "next/link";
import { useId } from "react";

import { APP_TEXTS, ESTIMATION_CONSENT_CHANNEL_LABELS } from "@/components/texts";
import { cn } from "@/components/ui/cn";
import { ESTIMATION_CONSENT_TEXTS, type EstimationConsentChannel } from "@/features/estimation/consent-texts";

import type { EstimationConsentErrors } from "./estimation-form.helpers";
import type { EstimationConsentChoices } from "../types";

const TEXTS = APP_TEXTS.estimation;

/** Order the four channels are presented in, matching the legal texts. */
const CHANNEL_ORDER: EstimationConsentChannel[] = ["email", "sms", "whatsapp", "phone"];

export type EstimationConsentGroupProps = {
  consents: EstimationConsentChoices;
  errors: EstimationConsentErrors;
  groupError: string | null;
  onToggle: (channel: EstimationConsentChannel, checked: boolean) => void;
};

/**
 * One checkbox per channel, **never** pre-ticked (CLAUDE.md: consent is a
 * positive act). The legal text is the visible label itself — it comes
 * byte-for-byte from `ESTIMATION_CONSENT_TEXTS`, never rewritten here, so it
 * always matches what the database records as proof.
 */
export function EstimationConsentGroup({ consents, errors, groupError, onToggle }: EstimationConsentGroupProps) {
  const groupErrorId = useId();

  return (
    <div>
      <fieldset aria-describedby={groupError ? groupErrorId : undefined}>
        <legend className="text-heading font-semibold text-ink">{TEXTS.consentTitle}</legend>
        <p className="mt-1 text-sm text-ink-muted">{TEXTS.consentSubtitle}</p>

        <div className="mt-5 flex flex-col gap-3">
          {CHANNEL_ORDER.map((channel) => (
            <ConsentCheckbox
              key={channel}
              channel={channel}
              checked={consents[channel]}
              error={errors[channel] ?? null}
              onChange={(checked) => onToggle(channel, checked)}
            />
          ))}
        </div>
      </fieldset>

      {groupError ? (
        <p id={groupErrorId} className="mt-3 text-sm font-medium text-ink" data-testid="consent-group-error">
          {groupError}
        </p>
      ) : null}

      <p className="mt-4 text-xs text-ink-subtle">
        {TEXTS.privacyPolicyIntro}{" "}
        <Link
          href="/politique-confidentialite"
          className="rounded-xs font-medium text-ink underline underline-offset-2 transition-colors duration-150 ease-standard hover:text-ink-muted"
        >
          {TEXTS.privacyPolicyLink}
        </Link>
        .
      </p>
    </div>
  );
}

type ConsentCheckboxProps = {
  channel: EstimationConsentChannel;
  checked: boolean;
  error: string | null;
  onChange: (checked: boolean) => void;
};

function ConsentCheckbox({ channel, checked, error, onChange }: ConsentCheckboxProps) {
  const id = useId();
  const errorId = `${id}-error`;

  return (
    <div>
      <label
        htmlFor={id}
        className={cn(
          "flex items-start gap-3 rounded-lg border bg-surface p-4 text-sm text-ink",
          "transition-[border-color] duration-150 ease-standard hover:border-ink-subtle",
          // Never colour alone: the border thickens the signal, the message below says why.
          error ? "border-ink" : "border-line-strong",
        )}
      >
        <input
          id={id}
          type="checkbox"
          checked={checked}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          onChange={(event) => onChange(event.target.checked)}
          className="mt-0.5 size-[18px] shrink-0 accent-inverse"
          data-testid={`estimation-consent-${channel}`}
        />
        <span>
          <span className="block text-xs font-semibold uppercase tracking-wide text-ink-subtle">
            {ESTIMATION_CONSENT_CHANNEL_LABELS[channel]}
          </span>
          <span className="mt-1 block leading-relaxed">{ESTIMATION_CONSENT_TEXTS[channel]}</span>
        </span>
      </label>
      {error ? (
        <p id={errorId} className="mt-1.5 ml-1 text-xs font-medium text-ink">
          {error}
        </p>
      ) : null}
    </div>
  );
}
