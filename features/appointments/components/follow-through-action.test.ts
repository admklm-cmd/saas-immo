import { describe, expect, it } from "vitest";

import { followThroughAction } from "./follow-through-action";

const START = "2026-09-29T08:00:00.000Z";
const AT_START = Date.parse(START);

describe("followThroughAction", () => {
  it("confirms a proposal whatever the time", () => {
    const item = { canBeConfirmed: true, canBeCompleted: false, startsAt: START };
    expect(followThroughAction(item, AT_START - 1)).toBe("confirm");
    expect(followThroughAction(item, AT_START + 1)).toBe("confirm");
  });

  it("closes a confirmed appointment only once it has started", () => {
    const item = { canBeConfirmed: false, canBeCompleted: true, startsAt: START };
    expect(followThroughAction(item, AT_START - 1)).toBe("open");
    expect(followThroughAction(item, AT_START)).toBe("close");
    expect(followThroughAction(item, AT_START + 1)).toBe("close");
  });

  it("offers no link when no action is possible", () => {
    expect(followThroughAction({ canBeConfirmed: false, canBeCompleted: false, startsAt: START }, AT_START)).toBeNull();
  });

  it("never unlocks « Clôturer » on an unreadable date", () => {
    expect(followThroughAction({ canBeConfirmed: false, canBeCompleted: true, startsAt: "n/a" }, AT_START)).toBe("open");
  });
});
