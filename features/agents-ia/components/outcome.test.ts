import { describe, expect, it } from "vitest";

import { actionFailureKind, refusalState } from "./outcome";

describe("actionFailureKind", () => {
  // Every code Emma can refuse with before any work: a rule doing its job.
  it.each([
    "follow_up_mandate_signed",
    "follow_up_contact_lost",
    "follow_up_already_drafted",
    "follow_up_already_prepared_today",
    "consent_not_granted",
    "follow_up_no_reachable_channel",
    "human_takeover",
    "ai_paused",
    "ai_daily_run_limit_reached",
  ])("%s is a guard-rail block", (code) => {
    expect(actionFailureKind(code)).toBe("blocked");
  });

  it.each(["ai_response_invalid", "ai_provider_unavailable", "unexpected_error", "contact_not_found"])(
    "%s is a technical error",
    (code) => {
      expect(actionFailureKind(code)).toBe("failed");
    },
  );

  it("never promotes an unknown or missing code to a block", () => {
    expect(actionFailureKind("something_new")).toBe("failed");
    expect(actionFailureKind(null)).toBe("failed");
    expect(actionFailureKind(undefined)).toBe("failed");
  });
});

describe("refusalState", () => {
  it("keeps the server message as-is", () => {
    expect(refusalState({ code: "ai_paused", message: "Suspendus." })).toEqual({
      kind: "blocked",
      message: "Suspendus.",
    });
    expect(refusalState({ code: "unexpected_error", message: "Oups." })).toEqual({
      kind: "error",
      message: "Oups.",
    });
  });
});
