/**
 * Block A of the hero — « Vous » in the ecosystem of the agents
 * (docs/design-system.md §2.11.8.3). Pure data and logic, no DOM, no clock:
 * the cycle (9 800 ms), its steps, which boxes are checked at any instant,
 * where the « Vous » cursor goes, and the loop scheduler (play, pause, resume)
 * with its timer functions injected, so everything is testable.
 *
 * The only loop of the landing (decision of the user, §2.11.8.1 n° 3): paused
 * off screen and in a hidden tab, still on its final state under reduced
 * motion. The final state is also the server HTML. A human box is only ever
 * checked by the cursor, after it has arrived on it; the missing information
 * (Hugo, « Motivation ») is never checked.
 */

export type CheckBy = "agent" | "you" | "missing";

/** Who checks each line of each card, in the order of `LANDING_TEXTS.journey.cards` (tested). */
export const ECOSYSTEM_LAYOUT: readonly (readonly CheckBy[])[] = [
  ["agent", "agent", "agent"], // Léa
  ["agent", "agent", "missing"], // Hugo
  ["agent", "agent"], // Emma
  ["you", "you"], // Validation humaine
  ["agent", "agent"], // Louis
  ["agent", "agent", "agent"], // Sarah
  ["you"], // Mandat
];

/** Length of one cycle, ms. */
export const CYCLE_MS = 9800;
/**
 * Press of a click: down for 60 ms, then back up in 60 ms (cursor 0.88, box
 * 0.92; CSS). The reset at t = 0 fades every check out in 240 ms (CSS).
 */
export const PRESS_DOWN_MS = 60;
/** Cadence of an agent: one box every 280 ms. */
export const AGENT_CADENCE_MS = 280;
/** The dashed box of the missing information is traced at this instant (200 ms). */
export const MISSING_TRACE_AT = 2300;

export type CheckRef = { card: number; line: number };
export type CheckEvent = CheckRef & { at: number };

/** The 15 checks of a cycle, in order (12 by the agents, 3 by you). */
export const CHECKS: readonly CheckEvent[] = [
  { card: 0, line: 0, at: 900 },
  { card: 0, line: 1, at: 1180 },
  { card: 0, line: 2, at: 1460 },
  { card: 1, line: 0, at: 1740 },
  { card: 1, line: 1, at: 2020 },
  { card: 2, line: 0, at: 2580 },
  { card: 2, line: 1, at: 2860 },
  { card: 3, line: 0, at: 3700 },
  { card: 3, line: 1, at: 4220 },
  { card: 4, line: 0, at: 4500 },
  { card: 4, line: 1, at: 4780 },
  { card: 5, line: 0, at: 5060 },
  { card: 5, line: 1, at: 5340 },
  { card: 5, line: 2, at: 5620 },
  { card: 6, line: 0, at: 6700 },
];

/** The missing line: traced, never checked. */
export const MISSING: CheckRef = { card: 1, line: 2 };

/** The card being worked on (cobalt ring) between `from` and `to`. */
export const RINGS: readonly { card: number; from: number; to: number }[] = [
  { card: 0, from: 900, to: 1740 },
  { card: 1, from: 1740, to: 2580 },
  { card: 2, from: 2580, to: 3140 },
  { card: 3, from: 3140, to: 4500 },
  { card: 4, from: 4500, to: 5060 },
  { card: 5, from: 5060, to: 5900 },
  { card: 6, from: 5900, to: 7200 },
];

/** `park`: the cursor waits under the first box of « Validation humaine » while the agents work. */
export type CursorTarget = "park" | CheckRef;
export type CursorMove = { at: number; target: CursorTarget; ms: number };

/** Where the cursor goes, when, and how long its glide lasts (a FLIP transition). */
export const CURSOR_MOVES: readonly CursorMove[] = [
  { at: 0, target: "park", ms: 900 },
  { at: 3140, target: { card: 3, line: 0 }, ms: 480 },
  { at: 3860, target: { card: 3, line: 1 }, ms: 280 },
  { at: 5900, target: { card: 6, line: 0 }, ms: 720 },
];

/** Clicks of the cursor: pressed at `at`, released `PRESS_DOWN_MS` later. */
export const PRESSES: readonly number[] = [3620, 4140, 6620];

export type EcosystemFrame = {
  /** Keys `card:line` of the checked boxes. */
  checked: ReadonlySet<string>;
  /** The dashed box of the missing information is drawn. */
  missingTraced: boolean;
  /** Card with the cobalt ring, or null. */
  ring: number | null;
  cursor: CursorTarget;
  /** Duration of the glide toward `cursor`, ms. */
  cursorMs: number;
  /** The cursor (and its box) is pressed. */
  pressed: boolean;
};

export function checkKey(ref: CheckRef): string {
  return `${ref.card}:${ref.line}`;
}

/** Every instant of a cycle where something changes, sorted; the first is 0 (the reset). */
export const STEP_TIMES: readonly number[] = Array.from(
  new Set([
    0,
    ...CHECKS.map((check) => check.at),
    MISSING_TRACE_AT,
    ...RINGS.flatMap((ring) => [ring.from, ring.to]),
    ...CURSOR_MOVES.map((move) => move.at),
    ...PRESSES.flatMap((at) => [at, at + PRESS_DOWN_MS]),
  ]),
)
  .filter((time) => time >= 0 && time < CYCLE_MS)
  .sort((a, b) => a - b);

/** The frame of the cycle at `t` ms (0 ≤ t < CYCLE_MS). */
export function frameAt(t: number): EcosystemFrame {
  const checked = new Set(CHECKS.filter((check) => check.at <= t).map(checkKey));
  const ring = RINGS.find((entry) => entry.from <= t && t < entry.to)?.card ?? null;
  let move: CursorMove = CURSOR_MOVES[0] as CursorMove;
  for (const candidate of CURSOR_MOVES) if (candidate.at <= t) move = candidate;
  const pressed = PRESSES.some((at) => at <= t && t < at + PRESS_DOWN_MS);
  return { checked, missingTraced: t >= MISSING_TRACE_AT, ring, cursor: move.target, cursorMs: move.ms, pressed };
}

/**
 * The final state: every agent box checked, « Motivation » traced and empty,
 * both human cards confirmed, the cursor on the box of the mandate, no ring.
 * Server HTML, no JavaScript, reduced motion, and the held end of a cycle.
 */
export function finalFrame(): EcosystemFrame {
  return frameAt(CYCLE_MS - 1);
}

/** The « Vous » pill of a human card is full when all its lines are checked. */
export function pillFull(frame: EcosystemFrame, card: number): boolean {
  const lines = ECOSYSTEM_LAYOUT[card] ?? [];
  return lines.length > 0 && lines.every((by, line) => by === "you" && frame.checked.has(checkKey({ card, line })));
}

/** Time from step `index` to the next one (the last step waits for the end of the cycle). */
export function stepDelay(index: number): number {
  const current = STEP_TIMES[index] ?? 0;
  const next = STEP_TIMES[index + 1] ?? CYCLE_MS;
  return next - current;
}

// ---------------------------------------------------------------------------
// Loop scheduler: one timer at most, never requestAnimationFrame.

export type LoopStatus = "reduced" | "paused" | "playing";

/** Beyond this lateness of a timer, the schedule restarts from now (ms). */
const MAX_LATE_MS = 1000;

export type LoopSnapshot = {
  status: LoopStatus;
  /** Step of the cycle shown, or null before the first start (the final state). */
  index: number | null;
  /** Number of cycles started since the load. */
  cycles: number;
};

export type LoopClock = {
  now: () => number;
  setTimeout: (callback: () => void, ms: number) => number;
  clearTimeout: (id: number) => void;
};

/**
 * Plays the cycle while the figure is on screen (≥ 25 %), the tab visible and
 * motion welcome. Off screen or hidden tab: paused — the current step keeps
 * its transition to its end, no timer is armed, and it resumes at the same
 * step with the time it had left. Reduced motion: the final state, no timer;
 * switched back on, the next start is a fresh reset.
 */
export class EcosystemLoop {
  private status: LoopStatus = "paused";
  private index: number | null = null;
  private cycles = 0;
  private timer: number | null = null;
  private stepStartedAt = 0;
  /** Time left on the current step when paused, ms. */
  private remaining: number | null = null;
  private onScreen = false;
  private pageVisible = true;
  private reduced = false;

  constructor(
    private readonly clock: LoopClock,
    private readonly onChange: (snapshot: LoopSnapshot) => void,
  ) {}

  snapshot(): LoopSnapshot {
    return { status: this.status, index: this.index, cycles: this.cycles };
  }

  setOnScreen(onScreen: boolean): void {
    this.onScreen = onScreen;
    this.sync();
  }

  setPageVisible(visible: boolean): void {
    this.pageVisible = visible;
    this.sync();
  }

  setReduced(reduced: boolean): void {
    if (reduced === this.reduced) return;
    this.reduced = reduced;
    if (reduced) {
      this.clear();
      this.index = null;
      this.remaining = null;
      this.status = "reduced";
      this.emit();
      return;
    }
    this.status = "paused";
    this.emit();
    this.sync();
  }

  dispose(): void {
    this.clear();
  }

  private sync(): void {
    if (this.reduced) return;
    const wanted = this.onScreen && this.pageVisible;
    if (wanted && this.status !== "playing") this.play();
    else if (!wanted && this.status === "playing") this.pause();
  }

  private play(): void {
    this.status = "playing";
    if (this.index === null) {
      // First start (or after reduced motion): a reset, then the cycle.
      this.enter(0, true);
      return;
    }
    const wait = this.remaining ?? stepDelay(this.index);
    this.remaining = null;
    this.stepStartedAt = this.clock.now() - (stepDelay(this.index) - wait);
    this.arm(wait);
    this.emit();
  }

  private pause(): void {
    this.clear();
    if (this.index !== null) {
      const elapsed = this.clock.now() - this.stepStartedAt;
      this.remaining = Math.max(0, stepDelay(this.index) - elapsed);
    }
    this.status = "paused";
    this.emit();
  }

  /**
   * Enters a step. `startedAt` is its ideal start (the end of the previous
   * step), not the instant the timer fired: the latency of each timer is not
   * added up, a cycle stays 9 800 ms long. Late by more than a second (a
   * throttled tab): the schedule restarts from now, no burst of catch-up steps.
   */
  private enter(index: number, newCycle: boolean, startedAt = this.clock.now()): void {
    const now = this.clock.now();
    this.index = index;
    if (newCycle) this.cycles += 1;
    this.stepStartedAt = now - startedAt > MAX_LATE_MS ? now : startedAt;
    this.arm(Math.max(0, this.stepStartedAt + stepDelay(index) - now));
    this.emit();
  }

  private advance = (): void => {
    this.timer = null;
    if (this.index === null || this.status !== "playing") return;
    const next = this.index + 1;
    const ideal = this.stepStartedAt + stepDelay(this.index);
    if (next >= STEP_TIMES.length) this.enter(0, true, ideal);
    else this.enter(next, false, ideal);
  };

  private arm(ms: number): void {
    this.clear();
    this.timer = this.clock.setTimeout(this.advance, ms);
  }

  private clear(): void {
    if (this.timer !== null) this.clock.clearTimeout(this.timer);
    this.timer = null;
  }

  private emit(): void {
    this.onChange(this.snapshot());
  }
}
