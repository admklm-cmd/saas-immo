import { describe, expect, it } from "vitest";

import { appointmentsInputSchema, UPCOMING_APPOINTMENT_STATUSES } from "./types";

describe("appointmentsInputSchema", () => {
  it("defaults to the upcoming view, first page", () => {
    expect(appointmentsInputSchema.parse({})).toEqual({ view: "upcoming", limit: 25, offset: 0 });
  });

  it("accepts both views and the bounds", () => {
    expect(appointmentsInputSchema.parse({ view: "past", limit: "100", offset: "5000" })).toEqual({
      view: "past",
      limit: 100,
      offset: 5000,
    });
  });

  it.each([
    { view: "all" },
    { view: "cancelled" },
    { limit: 0 },
    { limit: 101 },
    { offset: 5001 },
    { offset: -1 },
    { view: "past", agencyId: "11111111-1111-4111-8111-111111111111" },
  ])("refuses %o", (input) => {
    expect(appointmentsInputSchema.safeParse(input).success).toBe(false);
  });
});

describe("UPCOMING_APPOINTMENT_STATUSES", () => {
  it("is exactly the still-ahead statuses of the dashboard", () => {
    expect([...UPCOMING_APPOINTMENT_STATUSES]).toEqual(["proposed", "confirmed"]);
  });
});
