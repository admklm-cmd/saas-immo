/**
 * Block A of the hero — « Vous » in the ecosystem of the agents
 * (docs/design-system.md §2.11.8.8 L4-A, which replaces §2.11.8.3 / L3-A).
 * Pure data and logic, no DOM, no clock: the cycle (24 000 ms), its steps,
 * which boxes are checked at any instant, where the « Vous » cursor goes, and
 * the loop scheduler (play, pause, resume, restart) with its timer functions
 * injected, so everything is testable.
 *
 * Three blocks: Acquisition (Léa, Hugo, Emma), Validation humaine (you),
 * Suivi (Louis, Sarah). The only loop of the landing (§2.11.8.1 n° 3): paused
 * off screen and in a hidden tab, still on its final state under reduced
 * motion. The final state is also the server HTML. A human box is only ever
 * checked by the cursor, after it has arrived on it; the missing information
 * (Hugo, « Motivation ») is never checked; Sarah flags the mandate, only
 * « Vous » confirms it, later.
 */

export type CheckBy = "agent" | "you" | "missing";

/**
 * Who checks each line, block → group → line, in the order of
 * `LANDING_TEXTS.journey.blocks` (tested).
 */
export const ECOSYSTEM_LAYOUT: readonly (readonly (readonly CheckBy[])[])[] = [
  [
    ["agent", "agent", "agent"], // Léa
    ["agent", "agent", "missing"], // Hugo
    ["agent", "agent"], // Emma
  ],
  [
    ["you", "you"], // Premier message
    ["you"], // Mandat
  ],
  [
    ["agent", "agent"], // Louis
    ["agent", "agent", "agent"], // Sarah
  ],
];

/** Length of one cycle, ms (× 2.45 the 9 800 ms of Lot 3). */
export const CYCLE_MS = 24000;
/**
 * Press of a click: down for 150 ms, then back up in 150 ms (cursor 0.88,
 * box 0.92; CSS). The box is checked when the press is released. The reset at
 * t = 0 fades every check out in 600 ms (CSS).
 */
export const PRESS_DOWN_MS = 150;
/** Cadence of an agent: one box every 700 ms. */
export const AGENT_CADENCE_MS = 700;
/** The dashed box of the missing information is traced at this instant (400 ms). */
export const MISSING_TRACE_AT = 5100;

export type CheckRef = { block: number; group: number; line: number };
export type CheckEvent = CheckRef & { at: number };

/** The 15 checks of a cycle, in order (12 by the agents, 3 by you). */
export const CHECKS: readonly CheckEvent[] = [
  { block: 0, group: 0, line: 0, at: 1600 },
  { block: 0, group: 0, line: 1, at: 2300 },
  { block: 0, group: 0, line: 2, at: 3000 },
  { block: 0, group: 1, line: 0, at: 3700 },
  { block: 0, group: 1, line: 1, at: 4400 },
  { block: 0, group: 2, line: 0, at: 5800 },
  { block: 0, group: 2, line: 1, at: 6500 },
  { block: 1, group: 0, line: 0, at: 8750 },
  { block: 1, group: 0, line: 1, at: 9850 },
  { block: 2, group: 0, line: 0, at: 11000 },
  { block: 2, group: 0, line: 1, at: 11700 },
  { block: 2, group: 1, line: 0, at: 12400 },
  { block: 2, group: 1, line: 1, at: 13100 },
  { block: 2, group: 1, line: 2, at: 13800 },
  { block: 1, group: 1, line: 0, at: 15950 },
];

/** The missing line: traced, never checked. */
export const MISSING: CheckRef = { block: 0, group: 1, line: 2 };

/** The block being worked on (cobalt ring) between `from` and `to`. */
export const RINGS: readonly { block: number; from: number; to: number }[] = [
  { block: 0, from: 1600, to: 7200 },
  { block: 1, from: 7200, to: 10400 },
  { block: 2, from: 10800, to: 14400 },
  { block: 1, from: 14400, to: 17000 },
];

/** The app tile of a block plays its story once, at the start of its first ring of the cycle. */
export const TILE_STORIES: readonly { block: number; at: number }[] = [
  { block: 0, at: 1600 },
  { block: 1, at: 7200 },
  { block: 2, at: 10800 },
];

/** `park`: the cursor waits 20 px under « Validation humaine » while the agents work. */
export type CursorTarget = "park" | CheckRef;
export type CursorMove = { at: number; target: CursorTarget; ms: number };

/** Where the cursor goes, when, and how long its glide lasts (a FLIP transition). */
export const CURSOR_MOVES: readonly CursorMove[] = [
  { at: 0, target: "park", ms: 1400 },
  { at: 7400, target: { block: 1, group: 0, line: 0 }, ms: 1200 },
  { at: 9100, target: { block: 1, group: 0, line: 1 }, ms: 600 },
  { at: 10200, target: "park", ms: 1000 },
  { at: 14600, target: { block: 1, group: 1, line: 0 }, ms: 1200 },
];

/** Clicks of the cursor: pressed at `at`, released `PRESS_DOWN_MS` later (the box is checked then). */
export const PRESSES: readonly number[] = [8600, 9700, 15800];

export type EcosystemFrame = {
  /** Keys `block:group:line` of the checked boxes. */
  checked: ReadonlySet<string>;
  /** The dashed box of the missing information is drawn. */
  missingTraced: boolean;
  /** Block with the cobalt ring, or null. */
  ring: number | null;
  /** Block whose app tile plays its story (from the start of its ring to its end), or null. */
  story: number | null;
  cursor: CursorTarget;
  /** Duration of the glide toward `cursor`, ms. */
  cursorMs: number;
  /** The cursor (and its box) is pressed. */
  pressed: boolean;
};

export function checkKey(ref: CheckRef): string {
  return `${ref.block}:${ref.group}:${ref.line}`;
}

/** Every instant of a cycle where something changes, sorted; the first is 0 (the reset). */
export const STEP_TIMES: readonly number[] = Array.from(
  new Set([
    0,
    ...CHECKS.map((check) => check.at),
    MISSING_TRACE_AT,
    ...RINGS.flatMap((ring) => [ring.from, ring.to]),
    ...TILE_STORIES.map((story) => story.at),
    ...CURSOR_MOVES.map((move) => move.at),
    ...PRESSES.flatMap((at) => [at, at + PRESS_DOWN_MS]),
  ]),
)
  .filter((time) => time >= 0 && time < CYCLE_MS)
  .sort((a, b) => a - b);

/** The frame of the cycle at `t` ms (0 ≤ t < CYCLE_MS). */
export function frameAt(t: number): EcosystemFrame {
  const checked = new Set(CHECKS.filter((check) => check.at <= t).map(checkKey));
  const ringEntry = RINGS.find((entry) => entry.from <= t && t < entry.to) ?? null;
  const ring = ringEntry?.block ?? null;
  const story = ringEntry && TILE_STORIES.some((entry) => entry.block === ringEntry.block && entry.at === ringEntry.from) ? ringEntry.block : null;
  let move: CursorMove = CURSOR_MOVES[0] as CursorMove;
  for (const candidate of CURSOR_MOVES) if (candidate.at <= t) move = candidate;
  const pressed = PRESSES.some((at) => at <= t && t < at + PRESS_DOWN_MS);
  return { checked, missingTraced: t >= MISSING_TRACE_AT, ring, story, cursor: move.target, cursorMs: move.ms, pressed };
}

/**
 * The final state: every agent box checked, « Motivation » traced and empty,
 * the three « you » boxes checked, the cursor on « Mandat confirmé », no ring.
 * Server HTML, no JavaScript, reduced motion, and the held end of a cycle.
 */
export function finalFrame(): EcosystemFrame {
  return frameAt(CYCLE_MS - 1);
}

/** All the lines of a block, flattened with their reference. */
export function blockLines(block: number): (CheckRef & { by: CheckBy })[] {
  return (ECOSYSTEM_LAYOUT[block] ?? []).flatMap((group, groupIndex) =>
    group.map((by, line) => ({ block, group: groupIndex, line, by })),
  );
}

/** The « Vous » pill of the human block is full when its three lines are checked. */
export function pillFull(frame: EcosystemFrame, block: number): boolean {
  const lines = blockLines(block);
  return lines.length > 0 && lines.every((line) => line.by === "you" && frame.checked.has(checkKey(line)));
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

  /**
   * « Rejouer les animations » (docs/design-system.md §2.11.8.8 L4-D): back
   * to the armed state; the cycle starts again at t = 0 (the reset) now if
   * the figure is on screen, else when it comes back. Reduced motion: nothing.
   */
  restart(): void {
    if (this.reduced) return;
    this.clear();
    this.index = null;
    this.remaining = null;
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
   * added up, a cycle stays 24 000 ms long. Late by more than a second (a
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
