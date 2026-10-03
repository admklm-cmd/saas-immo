import { describe, expect, it } from "vitest";

import { LANDING_TEXTS } from "@/components/landing-texts";

import {
  BLOCKS,
  ControlTimelinePlayer,
  DAY_MS,
  END_MS,
  STEP_TIMES,
  VALIDATED_AT,
  YOU_ARRIVES_AT,
  finalFrame,
  frameAt,
  frameOf,
  initialFrame,
  type PlayerClock,
  type PlayerSnapshot,
} from "./control-timeline";

/** A fake clock: timers fire only when `advance` passes them. */
function fakeClock() {
  let now = 0;
  let nextId = 1;
  const timers = new Map<number, { at: number; callback: () => void }>();
  const clock: PlayerClock = {
    now: () => now,
    setTimeout: (callback, ms) => {
      const id = nextId++;
      timers.set(id, { at: now + ms, callback });
      return id;
    },
    clearTimeout: (id) => {
      timers.delete(id);
    },
  };
  function advance(ms: number) {
    const end = now + ms;
    for (;;) {
      const due = [...timers.entries()].filter(([, timer]) => timer.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!due) break;
      timers.delete(due[0]);
      now = due[1].at;
      due[1].callback();
    }
    now = end;
  }
  return { clock, advance, armed: () => timers.size };
}

describe("control timeline — instants (§2.11.8.7 L3-D)", () => {
  it("moves the playhead at 280 ms per day, linear", () => {
    expect(DAY_MS).toBe(280);
    expect(frameAt(0).playhead).toEqual({ day: 3.3, ms: 924, ease: "linear" });
    expect(Math.round(3.3 * DAY_MS)).toBe(924);
    expect(frameAt(1824).playhead).toEqual({ day: 8.6, ms: 1484, ease: "linear" });
    expect(Math.round((8.6 - 3.3) * DAY_MS)).toBe(1484);
  });

  it("holds every instant of the table", () => {
    for (const at of [0, 336, 364, 784, 924, 1404, 1524, 1584, 1824, 2272, 2636, 2972, 3308, 3760]) {
      expect(STEP_TIMES, `${at} ms`).toContain(at);
    }
    expect(STEP_TIMES[0]).toBe(0);
    expect(STEP_TIMES[STEP_TIMES.length - 1]).toBe(END_MS);
    expect(END_MS).toBe(3760);
    expect([...STEP_TIMES]).toEqual([...STEP_TIMES].sort((a, b) => a - b));
  });

  it("makes the blocks appear at their instants", () => {
    expect([...frameAt(0).shown]).toEqual(["lea"]);
    expect(frameAt(924).shown.has("firstContact")).toBe(true);
    expect(frameAt(923).shown.has("firstContact")).toBe(false);
    expect(frameAt(2272).shown.has("louis") && frameAt(2272).shown.has("followUp")).toBe(true);
    expect(frameAt(2636).shown.has("visit") && frameAt(2636).shown.has("stopped")).toBe(true);
    expect(frameAt(3307).shown.has("mandate")).toBe(false);
    expect(frameAt(3308).shown.has("mandate")).toBe(true);
  });

  it("validates « 1er contact » only after the « Vous » cursor has arrived, never before", () => {
    expect(YOU_ARRIVES_AT).toBe(1404);
    expect(VALIDATED_AT).toBeGreaterThan(YOU_ARRIVES_AT);
    for (const t of STEP_TIMES) {
      const frame = frameAt(t);
      expect(frame.firstContact, `${t} ms`).toBe(t >= 1584 ? "validated" : "pending");
    }
    // At its arrival, the cursor is on the block (target and day of its centre).
    expect(frameAt(924).you.target).toBe("firstContact");
    expect(frameAt(924).you.ms).toBe(480);
    expect(frameAt(1524).pressed).toBe(true);
    expect(frameAt(1584).pressed).toBe(false);
  });

  it("never validates the mandate: pending at every instant, the cursor stops under it", () => {
    for (const t of STEP_TIMES) expect(frameAt(t).mandate).toBe("pending");
    expect(finalFrame().you.target).toBe("mandate");
    expect(finalFrame().pressed).toBe(false);
    expect(BLOCKS.find((block) => block.key === "mandate")?.track).toBe("you");
  });

  it("walks the nine states of the file card in order", () => {
    const states = LANDING_TEXTS.control.tiles.timeline.states;
    expect(states).toHaveLength(9);
    const seen: number[] = [];
    for (const t of STEP_TIMES) {
      const index = frameAt(t).fileState;
      if (seen[seen.length - 1] !== index) seen.push(index);
    }
    expect(seen).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    expect(states[finalFrame().fileState]).toBe("Mandat · à confirmer par vous");
  });

  it("final state: every block, first contact validated, mandate pending, playhead at J8.6", () => {
    const frame = finalFrame();
    expect(frame.shown.size).toBe(BLOCKS.length);
    expect(frame.firstContact).toBe("validated");
    expect(frame.playhead.day).toBe(8.6);
    expect(frame.lea.day).toBe(1.2);
    expect(frame.emma).toMatchObject({ day: 6.0, visible: true });
    expect(frame.done).toBe(true);
  });

  it("initial state: playhead at J0, nothing shown, Emma hidden, Vous parked", () => {
    const frame = initialFrame();
    expect(frame.shown.size).toBe(0);
    expect(frame.playhead.day).toBe(0);
    expect(frame.lea.day).toBe(0);
    expect(frame.emma.visible).toBe(false);
    expect(frame.you.target).toBe("park");
    expect(frame.fileState).toBe(0);
  });
});

describe("ControlTimelinePlayer — once, one timer", () => {
  it("waits 400 ms after the trigger, plays every step, then stops for good", () => {
    const { clock, advance, armed } = fakeClock();
    const snapshots: PlayerSnapshot[] = [];
    const player = new ControlTimelinePlayer(clock, (snapshot) => snapshots.push(snapshot));
    expect(player.snapshot()).toEqual({ status: "idle", index: null });
    player.trigger();
    expect(player.snapshot().status).toBe("waiting");
    expect(armed()).toBe(1);
    advance(399);
    expect(player.snapshot().status).toBe("waiting");
    advance(1);
    expect(player.snapshot()).toEqual({ status: "playing", index: 0 });
    for (let elapsed = 0; elapsed < END_MS; elapsed += 50) {
      expect(armed()).toBeLessThanOrEqual(1);
      advance(50);
    }
    expect(player.snapshot()).toEqual({ status: "done", index: null });
    expect(armed()).toBe(0);
    const played = snapshots.filter((snapshot) => snapshot.status === "playing").map((snapshot) => snapshot.index);
    expect(played).toEqual(STEP_TIMES.slice(0, -1).map((_, index) => index));
  });

  it("ends 3 760 ms after the start, ≤ 4 160 ms after the trigger", () => {
    const { clock, advance } = fakeClock();
    const player = new ControlTimelinePlayer(clock, () => undefined);
    player.trigger();
    advance(400 + END_MS - 1);
    expect(player.snapshot().status).toBe("playing");
    advance(1);
    expect(player.snapshot().status).toBe("done");
  });

  it("never replays: a second trigger does nothing", () => {
    const { clock, advance, armed } = fakeClock();
    const player = new ControlTimelinePlayer(clock, () => undefined);
    player.trigger();
    advance(5000);
    player.trigger();
    expect(armed()).toBe(0);
    expect(player.snapshot().status).toBe("done");
  });

  it("reduced motion jumps to the final state and clears the timer", () => {
    const { clock, advance, armed } = fakeClock();
    const player = new ControlTimelinePlayer(clock, () => undefined);
    player.trigger();
    advance(1000);
    player.setReduced(true);
    expect(armed()).toBe(0);
    expect(frameOf(player.snapshot())).toEqual(finalFrame());
  });

  it("maps a snapshot to its frame", () => {
    expect(frameOf({ status: "idle", index: null })).toEqual(initialFrame());
    expect(frameOf({ status: "done", index: null })).toEqual(finalFrame());
    expect(frameOf({ status: "playing", index: 3 })).toEqual(frameAt(STEP_TIMES[3]!));
  });
});
