import { APP_TEXTS, ESTIMATION_PROPERTY_TYPE_LABELS } from "@/components/texts";
import { Field } from "@/components/ui/Field";
import { Select, type SelectOption } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";

import type { PropertyTypeChoice } from "../types";
import type { EstimationFieldErrors, EstimationFormState } from "./estimation-form.helpers";
import { EstimationRequiredLabel } from "./EstimationRequiredLabel";

const TEXTS = APP_TEXTS.estimation;

const PROPERTY_TYPE_OPTIONS: SelectOption[] = (
  Object.keys(ESTIMATION_PROPERTY_TYPE_LABELS) as PropertyTypeChoice[]
).map((value) => ({ value, label: ESTIMATION_PROPERTY_TYPE_LABELS[value] }));

export type EstimationPropertyFieldsProps = {
  state: Pick<
    EstimationFormState,
    "propertyType" | "city" | "postalCode" | "surfaceM2" | "rooms" | "message"
  >;
  errors: EstimationFieldErrors;
  onChangeText: (key: "city" | "postalCode" | "surfaceM2" | "rooms" | "message", value: string) => void;
  onChangePropertyType: (value: PropertyTypeChoice) => void;
};

/** What the visitor already knows about the property. */
export function EstimationPropertyFields({
  state,
  errors,
  onChangeText,
  onChangePropertyType,
}: EstimationPropertyFieldsProps) {
  return (
    <div>
      <h2 className="text-heading font-semibold text-ink">{TEXTS.propertyTitle}</h2>
      <p className="mt-1 text-sm text-ink-muted">{TEXTS.propertySubtitle}</p>

      {/*
       * Six columns on desktop so the three short fields (code postal,
       * surface, pièces) share one tidy row instead of being squeezed into
       * half the form. One column below 640 px.
       */}
      <div className="mt-5 grid gap-4 sm:grid-cols-6">
        <Select
          id="estimation-property-type"
          label={TEXTS.propertyType}
          options={PROPERTY_TYPE_OPTIONS}
          value={state.propertyType}
          onChange={(event) => onChangePropertyType(event.target.value as PropertyTypeChoice)}
          className="sm:col-span-3"
        />
        <Field
          label={<EstimationRequiredLabel>{TEXTS.city}</EstimationRequiredLabel>}
          autoComplete="address-level2"
          maxLength={120}
          required
          value={state.city}
          error={errors.city}
          onChange={(event) => onChangeText("city", event.target.value)}
          className="sm:col-span-3"
        />
        <Field
          label={<EstimationRequiredLabel>{TEXTS.postalCode}</EstimationRequiredLabel>}
          inputMode="numeric"
          autoComplete="postal-code"
          maxLength={5}
          required
          value={state.postalCode}
          error={errors.postalCode}
          onChange={(event) => onChangeText("postalCode", event.target.value)}
          className="sm:col-span-2"
        />
        <Field
          label={TEXTS.surface}
          type="number"
          inputMode="decimal"
          min={1}
          max={100_000}
          value={state.surfaceM2}
          error={errors.surfaceM2}
          hint={!errors.surfaceM2 ? TEXTS.surfaceHint : undefined}
          onChange={(event) => onChangeText("surfaceM2", event.target.value)}
          className="sm:col-span-2"
        />
        <Field
          label={TEXTS.rooms}
          type="number"
          inputMode="numeric"
          min={1}
          max={50}
          value={state.rooms}
          error={errors.rooms}
          hint={!errors.rooms ? TEXTS.roomsHint : undefined}
          onChange={(event) => onChangeText("rooms", event.target.value)}
          className="sm:col-span-2"
        />
      </div>

      <Textarea
        label={TEXTS.message}
        hint={!errors.message ? TEXTS.messageHint : undefined}
        error={errors.message}
        maxLength={2000}
        rows={4}
        value={state.message}
        onChange={(event) => onChangeText("message", event.target.value)}
        className="mt-4"
      />
    </div>
  );
}
