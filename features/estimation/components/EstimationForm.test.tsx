// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { APP_TEXTS, ESTIMATION_CONSENT_CHANNEL_LABELS } from "@/components/texts";
import {
  ESTIMATION_CONSENT_TEXTS,
  type EstimationConsentChannel,
} from "@/features/estimation/consent-texts";

import { EstimationForm } from "./EstimationForm";

const TEXTS = APP_TEXTS.estimation;

/**
 * Derived from the canonical list, not retyped: a channel added to
 * `consent-texts.ts` but forgotten in the form fails these tests.
 */
const CHANNELS = Object.keys(ESTIMATION_CONSENT_TEXTS) as EstimationConsentChannel[];

function escapeForRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Matches a field by its name, with or without the visible "(obligatoire)"
 * marker. Anchored on both ends on purpose: "Nom" must not also match
 * "Prénom" or "Nombre de pièces".
 */
function label(text: string): RegExp {
  return new RegExp(`^${escapeForRegExp(text)}( ${escapeForRegExp(TEXTS.requiredMark)})?$`);
}

const submitEstimationRequest = vi.hoisted(() => vi.fn());

vi.mock("@/features/estimation/actions", () => ({ submitEstimationRequest }));

beforeEach(() => {
  submitEstimationRequest.mockReset().mockResolvedValue({ data: { status: "received" }, error: null });
});

afterEach(() => {
  cleanup();
});

/** Fills every field the schema requires, leaving consents to the caller. */
function fillRequiredFields() {
  fireEvent.change(screen.getByLabelText(label(TEXTS.firstName)), { target: { value: "Camille" } });
  fireEvent.change(screen.getByLabelText(label(TEXTS.lastName)), { target: { value: "Durand" } });
  fireEvent.change(screen.getByLabelText(label(TEXTS.email)), {
    target: { value: "camille.durand@example.test" },
  });
  fireEvent.change(screen.getByLabelText(label(TEXTS.city)), { target: { value: "La Ciotat" } });
  fireEvent.change(screen.getByLabelText(label(TEXTS.postalCode)), { target: { value: "13600" } });
}

describe("EstimationForm — soumission avant hydratation", () => {
  it("déclare method=post : une soumission native ne met jamais de données personnelles dans l'URL", () => {
    const { container } = render(<EstimationForm />);
    expect(container.querySelector("form")?.getAttribute("method")).toBe("post");
  });
});

describe("EstimationForm — cases de consentement", () => {
  it("n'a aucune case de consentement cochée au montage", () => {
    render(<EstimationForm />);

    for (const channel of CHANNELS) {
      const checkbox = screen.getByTestId(`estimation-consent-${channel}`) as HTMLInputElement;
      expect(checkbox.checked).toBe(false);
    }
  });

  // Deliberately blind to `data-testid`: a fifth channel added one day, or a
  // `defaultChecked` slipped into any box, fails here too.
  it("ne coche aucune case à cocher du formulaire, quelle qu'elle soit", () => {
    const { container } = render(<EstimationForm />);

    const boxes = Array.from(container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'));
    expect(boxes.length).toBe(CHANNELS.length);
    for (const box of boxes) {
      expect(box.checked).toBe(false);
      expect(box.hasAttribute("checked")).toBe(false);
    }
  });

  it("affiche mot pour mot le texte de consentement enregistré comme preuve", () => {
    render(<EstimationForm />);

    for (const channel of CHANNELS) {
      const checkbox = screen.getByTestId(`estimation-consent-${channel}`);
      const box = checkbox.closest("label");
      expect(box?.textContent).toContain(ESTIMATION_CONSENT_TEXTS[channel]);
      expect(box?.textContent).toContain(ESTIMATION_CONSENT_CHANNEL_LABELS[channel]);
    }
  });

  it("dirige vers la politique de confidentialité", () => {
    render(<EstimationForm />);

    const link = screen.getByRole("link", { name: TEXTS.privacyPolicyLink });
    expect(link.getAttribute("href")).toBe("/politique-confidentialite");
  });
});

describe("EstimationForm — accessibilité", () => {
  it("signale les champs obligatoires par du texte, jamais par la seule couleur", () => {
    render(<EstimationForm />);

    for (const name of [TEXTS.firstName, TEXTS.lastName, TEXTS.city, TEXTS.postalCode]) {
      const field = screen.getByLabelText(label(name));
      expect(field.getAttribute("required")).not.toBeNull();
      const labelElement = field.closest("div")?.querySelector("label");
      expect(labelElement?.textContent).toContain(TEXTS.requiredMark);
    }
  });

  it("relie chaque message d'erreur au champ concerné", async () => {
    render(<EstimationForm />);
    fillRequiredFields();
    fireEvent.change(screen.getByLabelText(label(TEXTS.email)), { target: { value: "pas-un-email" } });
    fireEvent.click(screen.getByTestId("estimation-consent-email"));

    await act(async () => {
      fireEvent.click(screen.getByTestId("estimation-submit"));
    });

    expect(submitEstimationRequest).not.toHaveBeenCalled();

    const email = screen.getByLabelText(label(TEXTS.email));
    expect(email.getAttribute("aria-invalid")).toBe("true");
    const describedBy = email.getAttribute("aria-describedby");
    expect(describedBy).not.toBeNull();
    const described = document.getElementById(describedBy!.split(" ")[0]!);
    expect(described?.textContent).toBe("Adresse email invalide.");
  });

  it("annonce le récapitulatif d'erreur dans une région live et y déplace le focus", async () => {
    render(<EstimationForm />);
    fillRequiredFields();

    await act(async () => {
      fireEvent.click(screen.getByTestId("estimation-submit"));
    });

    const summary = screen.getByTestId("estimation-form-error");
    expect(summary.getAttribute("role")).toBe("alert");
    expect(summary.closest("[aria-live]")?.getAttribute("aria-live")).toBe("polite");
    expect(document.activeElement).toBe(summary.parentElement);
  });
});

describe("EstimationForm — champ piège", () => {
  it("reste invisible, non annoncé et hors du flux de tabulation", () => {
    const { container } = render(<EstimationForm />);

    const honeypot = container.querySelector('input[name="website"]');
    expect(honeypot).not.toBeNull();
    expect(honeypot?.getAttribute("aria-hidden")).toBe("true");
    expect(honeypot?.getAttribute("tabindex")).toBe("-1");
    expect(honeypot?.getAttribute("autocomplete")).toBe("off");
    // No visible label points to it: a real visitor never sees or fills it.
    expect(screen.queryByLabelText(/site|website/i)).toBeNull();
  });
});

describe("EstimationForm — validation côté client", () => {
  it("bloque l'envoi tant qu'aucun canal de contact n'est autorisé", async () => {
    render(<EstimationForm />);
    fillRequiredFields();

    await act(async () => {
      fireEvent.click(screen.getByTestId("estimation-submit"));
    });

    expect(submitEstimationRequest).not.toHaveBeenCalled();
    expect(screen.getByTestId("estimation-form-error")).toBeDefined();
    expect(screen.getByTestId("consent-group-error").textContent).toBe(TEXTS.consentGroupError);
  });

  it("ne montre jamais de prix ni de fourchette", () => {
    const { container } = render(<EstimationForm />);
    expect(container.textContent).not.toMatch(/€|EUR\b/);
  });
});

describe("EstimationForm — envoi", () => {
  it("envoie la demande avec le consentement coché et affiche la confirmation, sans pouvoir la renvoyer", async () => {
    render(<EstimationForm />);
    fillRequiredFields();
    fireEvent.click(screen.getByTestId("estimation-consent-email"));

    await act(async () => {
      fireEvent.click(screen.getByTestId("estimation-submit"));
    });

    expect(submitEstimationRequest).toHaveBeenCalledTimes(1);
    const payload = submitEstimationRequest.mock.calls[0]![0];
    expect(payload).toMatchObject({
      firstName: "Camille",
      lastName: "Durand",
      email: "camille.durand@example.test",
      city: "La Ciotat",
      postalCode: "13600",
      consents: { email: true, sms: false, whatsapp: false, phone: false },
      website: "",
    });

    const success = await screen.findByTestId("estimation-success");
    expect(success.textContent).toContain(TEXTS.successBody);
    expect(success.textContent).not.toMatch(/€/);
    // The form itself is gone: a double click cannot submit it twice.
    expect(screen.queryByTestId("estimation-submit")).toBeNull();
  });

  it("affiche le message d'erreur renvoyé par le serveur, mot pour mot", async () => {
    submitEstimationRequest.mockResolvedValue({
      data: null,
      error: { code: "rate_limited", message: "Trop de demandes ont été envoyées récemment. Merci de réessayer un peu plus tard." },
    });
    render(<EstimationForm />);
    fillRequiredFields();
    fireEvent.click(screen.getByTestId("estimation-consent-email"));

    await act(async () => {
      fireEvent.click(screen.getByTestId("estimation-submit"));
    });

    await waitFor(() => {
      expect(screen.getByTestId("estimation-server-error").textContent).toContain(
        "Trop de demandes ont été envoyées récemment. Merci de réessayer un peu plus tard.",
      );
    });
    // Nothing invented beyond the server's own message: no guessed delay.
    expect(screen.getByTestId("estimation-server-error").textContent).not.toMatch(/\d+\s*(minutes?|heures?)/);
    // The form remains usable: it was not silently replaced by a success state.
    expect(screen.getByTestId("estimation-submit")).toBeDefined();
  });
});
