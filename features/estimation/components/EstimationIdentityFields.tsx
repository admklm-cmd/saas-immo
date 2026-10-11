import { APP_TEXTS } from "@/components/texts";
import { Field } from "@/components/ui/Field";

import type { EstimationFieldErrors, EstimationFormState } from "./estimation-form.helpers";
import { EstimationRequiredLabel } from "./EstimationRequiredLabel";

const TEXTS = APP_TEXTS.estimation;

export type EstimationIdentityFieldsProps = {
  state: Pick<EstimationFormState, "firstName" | "lastName" | "email" | "phone">;
  errors: EstimationFieldErrors;
  onChange: (key: "firstName" | "lastName" | "email" | "phone", value: string) => void;
};

/** Identity and contact details — who the agency will call back. */
export function EstimationIdentityFields({ state, errors, onChange }: EstimationIdentityFieldsProps) {
  return (
    <div>
      <h2 className="text-heading font-semibold text-ink">{TEXTS.identityTitle}</h2>
      <p className="mt-1 text-sm text-ink-muted">{TEXTS.identitySubtitle}</p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Field
          label={<EstimationRequiredLabel>{TEXTS.firstName}</EstimationRequiredLabel>}
          autoComplete="given-name"
          maxLength={100}
          required
          value={state.firstName}
          error={errors.firstName}
          onChange={(event) => onChange("firstName", event.target.value)}
        />
        <Field
          label={<EstimationRequiredLabel>{TEXTS.lastName}</EstimationRequiredLabel>}
          autoComplete="family-name"
          maxLength={100}
          required
          value={state.lastName}
          error={errors.lastName}
          onChange={(event) => onChange("lastName", event.target.value)}
        />
        <Field
          label={TEXTS.email}
          type="email"
          autoComplete="email"
          maxLength={320}
          value={state.email}
          error={errors.email}
          hint={!errors.email ? TEXTS.contactHint : undefined}
          onChange={(event) => onChange("email", event.target.value)}
        />
        <Field
          label={TEXTS.phone}
          type="tel"
          autoComplete="tel"
          maxLength={30}
          value={state.phone}
          error={errors.phone}
          onChange={(event) => onChange("phone", event.target.value)}
        />
      </div>
    </div>
  );
}
