import { describe, expect, it } from "vitest";

import { refusalUiState } from "./refusal-ui-state";

describe("refusalUiState", () => {
  it("keeps a guard rail as neutral information, never retried", () => {
    expect(refusalUiState({ code: "ai_paused", message: "Suspendus." })).toEqual({
      kind: "blocked",
      message: "Suspendus.",
    });
    expect(refusalUiState({ code: "consent_not_granted", message: "Refusé." }).kind).toBe("blocked");
  });

  it("offers a new attempt only for a technical failure", () => {
    expect(refusalUiState({ code: "ai_provider_unavailable", message: "Indisponible." })).toEqual({
      kind: "error",
      message: "Indisponible.",
      retryable: true,
    });
    expect(refusalUiState({ code: "contact_not_found", message: "Contact introuvable." })).toEqual({
      kind: "error",
      message: "Contact introuvable.",
      retryable: false,
    });
  });
});
