import { describe, expect, it } from "vitest";

import { isRetryableErrorCode } from "./retryable";

describe("isRetryableErrorCode", () => {
  it("offers a new attempt for technical failures", () => {
    expect(isRetryableErrorCode("unexpected_error")).toBe(true);
    expect(isRetryableErrorCode("ai_provider_unavailable")).toBe(true);
    expect(isRetryableErrorCode("ai_response_invalid")).toBe(true);
    expect(isRetryableErrorCode("contacts_read_failed")).toBe(true);
    expect(isRetryableErrorCode("property_write_failed")).toBe(true);
    expect(isRetryableErrorCode("outbound_message_insert_failed")).toBe(true);
    expect(isRetryableErrorCode("contact_update_failed")).toBe(true);
  });

  it("never for a guard rail or a business refusal", () => {
    for (const code of [
      "ai_paused",
      "consent_not_granted",
      "human_takeover",
      "task_already_done",
      "contact_not_found",
      "forbidden",
      "stage_mandate_exit_director_only",
      // An invalid input fails the same way again.
      "validation_failed",
    ]) {
      expect(isRetryableErrorCode(code)).toBe(false);
    }
    expect(isRetryableErrorCode(null)).toBe(false);
    expect(isRetryableErrorCode(undefined)).toBe(false);
  });
});
