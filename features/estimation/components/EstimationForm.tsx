"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

import { APP_TEXTS } from "@/components/texts";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { useSingleFlight } from "@/components/ui/use-single-flight";

import { submitEstimationRequest } from "../actions";
import type { EstimationConsentChannel } from "../consent-texts";
import { estimationRequestSchema, type PropertyTypeChoice } from "../types";
import { EstimationConsentGroup } from "./EstimationConsentGroup";
import {
  buildEstimationInput,
  INITIAL_ESTIMATION_FORM_STATE,
  mapEstimationIssues,
  type EstimationFormState,
  type MappedEstimationErrors,
} from "./estimation-form.helpers";
import { EstimationIdentityFields } from "./EstimationIdentityFields";
import { EstimationPropertyFields } from "./EstimationPropertyFields";

const TEXTS = APP_TEXTS.estimation;

const EMPTY_ERRORS: MappedEstimationErrors = { fields: {}, consents: {}, consentGroup: null };

type FormStatus =
  | { kind: "idle" }
  /** `hasVisibleDetail`: at least one message is actually shown next to a field. */
  | { kind: "invalid"; hasVisibleDetail: boolean }
  | { kind: "submitting" }
  | { kind: "error"; message: string }
  | { kind: "success" };

/**
 * Would the summary "check the fields below" point at something real? If the
 * schema ever rejects a path this screen does not render (no field, no
 * checkbox), the visitor must not be sent looking for a message that is not
 * there — they get a plain "read your answers again" instead.
 */
function hasVisibleDetail(errors: MappedEstimationErrors): boolean {
  return (
    Object.keys(errors.fields).length > 0 ||
    Object.keys(errors.consents).length > 0 ||
    errors.consentGroup !== null
  );
}

/**
 * The public estimation request form.
 *
 * No price ever appears here (there is no such field in the contract — see
 * `features/estimation/types.ts`). Client-side validation reuses
 * `estimationRequestSchema` directly instead of restating its rules: the
 * server (and the database function behind it) revalidates everything again
 * and is the only authority — see `estimation-form.helpers.ts`.
 */
export function EstimationForm() {
  const [state, setState] = useState<EstimationFormState>(INITIAL_ESTIMATION_FORM_STATE);
  const [errors, setErrors] = useState<MappedEstimationErrors>(EMPTY_ERRORS);
  const [status, setStatus] = useState<FormStatus>({ kind: "idle" });
  const feedbackRef = useRef<HTMLDivElement>(null);
  const singleFlight = useSingleFlight();

  // Focus goes to the message on every outcome that needs the visitor's
  // attention: a client-side validation failure, a server refusal, or the
  // final confirmation.
  useEffect(() => {
    if (status.kind === "invalid" || status.kind === "error" || status.kind === "success") {
      feedbackRef.current?.focus();
    }
  }, [status]);

  function updateField<K extends keyof EstimationFormState>(key: K, value: EstimationFormState[K]) {
    setState((previous) => ({ ...previous, [key]: value }));
  }

  function toggleConsent(channel: EstimationConsentChannel, checked: boolean) {
    setState((previous) => ({ ...previous, consents: { ...previous.consents, [channel]: checked } }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Belt and braces: the button is already disabled while busy or done.
    if (status.kind === "submitting" || status.kind === "success") return;

    const input = buildEstimationInput(state);
    const parsed = estimationRequestSchema.safeParse(input);
    if (!parsed.success) {
      const mapped = mapEstimationIssues(parsed.error.issues);
      setErrors(mapped);
      setStatus({ kind: "invalid", hasVisibleDetail: hasVisibleDetail(mapped) });
      return;
    }

    setErrors(EMPTY_ERRORS);
    // A second submit landing before the re-render is ignored: one request only.
    await singleFlight(async () => {
      setStatus({ kind: "submitting" });
      try {
        const { error } = await submitEstimationRequest(parsed.data);
        if (error) {
          // The server message is already French, already precise, and never a
          // technical detail — shown exactly as returned.
          setStatus({ kind: "error", message: error.message });
          return;
        }
        setStatus({ kind: "success" });
      } catch {
        setStatus({ kind: "error", message: APP_TEXTS.states.unexpected });
      }
    });
  }

  if (status.kind === "success") {
    return (
      <div ref={feedbackRef} tabIndex={-1} aria-live="polite">
        <Alert tone="success" title={TEXTS.successTitle} testId="estimation-success">
          <p>{TEXTS.successBody}</p>
          <p className="mt-2">{TEXTS.successNote}</p>
        </Alert>
      </div>
    );
  }

  const busy = status.kind === "submitting";

  return (
    <form
      // POST, never the default GET: a submission landing before hydration must
      // not put personal data in the URL, history or access logs (guarded by
      // components/form-method.guard.test.ts).
      method="post"
      noValidate
      data-sensitive=""
      onSubmit={(event) => void handleSubmit(event)}
      aria-busy={busy || undefined}
      className="flex flex-col gap-10"
    >
      <div aria-live="polite">
        {status.kind === "invalid" ? (
          <div ref={feedbackRef} tabIndex={-1}>
            <Alert tone="error" title={TEXTS.formErrorTitle} testId="estimation-form-error">
              {status.hasVisibleDetail ? TEXTS.formErrorBody : TEXTS.formErrorBodyGeneric}
            </Alert>
          </div>
        ) : null}
        {status.kind === "error" ? (
          <div ref={feedbackRef} tabIndex={-1}>
            <Alert tone="error" title={TEXTS.serverErrorTitle} testId="estimation-server-error">
              {status.message}
            </Alert>
          </div>
        ) : null}
      </div>

      <EstimationIdentityFields state={state} errors={errors.fields} onChange={updateField} />

      <EstimationPropertyFields
        state={state}
        errors={errors.fields}
        onChangeText={updateField}
        onChangePropertyType={(value: PropertyTypeChoice) => updateField("propertyType", value)}
      />

      <EstimationConsentGroup
        consents={state.consents}
        errors={errors.consents}
        groupError={errors.consentGroup}
        onToggle={toggleConsent}
      />

      {/*
       * Honeypot: invisible to a real visitor, never announced, never in the
       * tab order. A real browser always leaves this "" — see
       * `features/estimation/estimation.ts` for what a filled value does.
       */}
      <input
        type="text"
        name="website"
        aria-hidden="true"
        tabIndex={-1}
        autoComplete="off"
        value={state.website}
        onChange={(event) => updateField("website", event.target.value)}
        className="pointer-events-none absolute -left-[9999px] top-0 h-px w-px overflow-hidden"
      />

      <div className="flex flex-col gap-3 border-t border-line pt-6">
        <Button type="submit" size="lg" isLoading={busy} className="self-start" data-testid="estimation-submit">
          {busy ? TEXTS.submitting : TEXTS.submit}
        </Button>
        <p className="text-xs text-ink-subtle">{TEXTS.submitNote}</p>
      </div>
    </form>
  );
}
