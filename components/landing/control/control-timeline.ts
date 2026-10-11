/**
 * The timeline of the control section (docs/design-system.md §2.11.8.7 L3-D,
 * tile 2): a fictitious dossier over ten days, a playhead at 280 ms per day,
 * three tracks of blocks and three labelled cursors. Pure: no DOM, no React —
 * the frames, the instants and a player that plays ONCE (no loop) with one
 * injected timer at most, never `requestAnimationFrame`.
 */

/** Playhead speed: 280 ms per day, `linear` (it is time). */
export const DAY_MS = 280;
/** Wait between the trigger (frame ≥ 50 % on screen) and the start: the tile has finished arriving. */
export const START_DELAY_MS = 400;
/** The press of the « Vous » cursor on « 1er contact »: down, then up and validated. */
export const PRESS_AT = 1524;
export const VALIDATED_AT = 1584;
/** `data-visual-state="done"`. */
export const END_MS = 3760;

export type TrackKey = "agents" | "emma" | "you";
export type BlockStyle = "agent" | "missing" | "consent" | "stopped" | "decision" | "human";
export type BlockKey =
  | "lea"
  | "hugo"
  | "missing"
  | "louis"
  | "sarah"
  | "consent"
  | "followUp"
  | "stopped"
  | "firstContact"
  | "visit"
  | "mandate";

export type TimelineBlock = {
  key: BlockKey;
  track: TrackKey;
  /** First and last day (0 to 10). */
  from: number;
  to: number;
  style: BlockStyle;
  /** Instant the block appears, ms. */
  at: number;
};

/** The blocks, in the order they appear (illustration data, fictitious example). */
export const BLOCKS: readonly TimelineBlock[] = [
  { key: "lea", track: "agents", from: 0, to: 1.2, style: "agent", at: 0 },
  { key: "consent", track: "emma", from: 1.0, to: 3.2, style: "consent", at: 336 },
  { key: "hugo", track: "agents", from: 1.3, to: 2.7, style: "agent", at: 364 },
  { key: "missing", track: "agents", from: 2.8, to: 4.3, style: "missing", at: 784 },
  { key: "firstContact", track: "you", from: 3.3, to: 4.8, style: "decision", at: 924 },
  { key: "louis", track: "agents", from: 4.9, to: 6.1, style: "agent", at: 2272 },
  { key: "followUp", track: "emma", from: 4.9, to: 6.0, style: "agent", at: 2272 },
  { key: "visit", track: "you", from: 6.2, to: 7.2, style: "human", at: 2636 },
  { key: "stopped", track: "emma", from: 6.2, to: 7.4, style: "stopped", at: 2636 },
  { key: "sarah", track: "agents", from: 7.4, to: 8.4, style: "agent", at: 2972 },
  { key: "mandate", track: "you", from: 8.6, to: 10, style: "decision", at: 3308 },
];

/** A position on the time axis, with the transition that leads there (0 = jump). */
export type AxisMove = { day: number; ms: number; ease: "linear" | "emphasis" };
/** Where the « Vous » cursor is: parked under its track, or on a block (centre), or under the mandate. */
export type YouTarget = "park" | "firstContact" | "visit" | "mandate";
export type YouMove = { target: YouTarget; day: number; ms: number };

/** Day of the tip of the « Vous » cursor for each target. */
export const YOU_DAYS: Readonly<Record<YouTarget, number>> = {
  park: 1.0,
  firstContact: (3.3 + 4.8) / 2,
  visit: (6.2 + 7.2) / 2,
  mandate: 9.3,
};

type Timed<T> = T & { at: number };

const PLAYHEAD: readonly Timed<AxisMove>[] = [
  { at: 0, day: 3.3, ms: 924, ease: "linear" },
  { at: 1824, day: 8.6, ms: 1484, ease: "linear" },
];
const LEA_CURSOR: readonly Timed<AxisMove>[] = [{ at: 0, day: 1.2, ms: 336, ease: "linear" }];
/** Emma appears at J1.2 (opacity 160 ms), then glides. */
const EMMA_SHOWN_AT = 336;
const EMMA_CURSOR: readonly Timed<AxisMove>[] = [
  { at: 336, day: 1.2, ms: 0, ease: "linear" },
  { at: 496, day: 3.2, ms: 560, ease: "linear" },
  { at: 2272, day: 6.0, ms: 308, ease: "emphasis" },
];
const YOU_CURSOR: readonly Timed<YouMove>[] = [
  { at: 924, target: "firstContact", day: YOU_DAYS.firstContact, ms: 480 },
  { at: 2636, target: "visit", day: YOU_DAYS.visit, ms: 320 },
  { at: 3308, target: "mandate", day: YOU_DAYS.mandate, ms: 400 },
];
/** Instant the « Vous » cursor reaches « 1er contact » (924 + 480). */
export const YOU_ARRIVES_AT = 1404;
/** The state line of the file card: index into `tiles.timeline.states`, from this instant. */
const FILE_STATES: readonly number[] = [0, 364, 784, 924, VALIDATED_AT, 2272, 2636, 2972, 3308];

export type TimelineFrame = {
  shown: ReadonlySet<BlockKey>;
  firstContact: "pending" | "validated";
  /** The mandate is never validated in this example: a human confirms it. */
  mandate: "pending";
  playhead: AxisMove;
  lea: AxisMove;
  emma: AxisMove & { visible: boolean };
  you: YouMove;
  /** The click of the « Vous » cursor (and the slight press of the block). */
  pressed: boolean;
  /** Index of the state of the file card (0 to 8). */
  fileState: number;
  done: boolean;
};

function lastAt<T extends { at: number }>(list: readonly T[], t: number): T | null {
  let found: T | null = null;
  for (const entry of list) if (entry.at <= t) found = entry;
  return found;
}

function axis(move: Timed<AxisMove> | null, fallback: number): AxisMove {
  return move ? { day: move.day, ms: move.ms, ease: move.ease } : { day: fallback, ms: 0, ease: "linear" };
}

/** Every instant where something changes, sorted; the first is 0, the last is the end. */
export const STEP_TIMES: readonly number[] = Array.from(
  new Set([
    0,
    ...BLOCKS.map((block) => block.at),
    ...PLAYHEAD.map((move) => move.at),
    ...EMMA_CURSOR.map((move) => move.at),
    ...YOU_CURSOR.map((move) => move.at),
    YOU_ARRIVES_AT,
    PRESS_AT,
    VALIDATED_AT,
    ...FILE_STATES,
    END_MS,
  ]),
).sort((a, b) => a - b);

/** The frame at `t` ms after the start (0 ≤ t; beyond the end, the end). */
export function frameAt(t: number): TimelineFrame {
  const you = lastAt(YOU_CURSOR, t);
  let fileState = 0;
  FILE_STATES.forEach((at, index) => {
    if (at <= t) fileState = index;
  });
  return {
    shown: new Set(BLOCKS.filter((block) => block.at <= t).map((block) => block.key)),
    firstContact: t >= VALIDATED_AT ? "validated" : "pending",
    mandate: "pending",
    playhead: axis(lastAt(PLAYHEAD, t), 0),
    lea: axis(lastAt(LEA_CURSOR, t), 0),
    emma: { ...axis(lastAt(EMMA_CURSOR, t), 1.2), visible: t >= EMMA_SHOWN_AT },
    you: you ? { target: you.target, day: you.day, ms: you.ms } : { target: "park", day: YOU_DAYS.park, ms: 0 },
    pressed: t >= PRESS_AT && t < VALIDATED_AT,
    fileState,
    done: t >= END_MS,
  };
}

/**
 * The initial state, before the start: playhead at J0, no block, « Léa » at
 * J0, « Emma » hidden, « Vous » parked, « Demande reçue · Léa ».
 */
export function initialFrame(): TimelineFrame {
  return {
    shown: new Set(),
    firstContact: "pending",
    mandate: "pending",
    playhead: { day: 0, ms: 0, ease: "linear" },
    lea: { day: 0, ms: 0, ease: "linear" },
    emma: { day: 1.2, ms: 0, ease: "linear", visible: false },
    you: { target: "park", day: YOU_DAYS.park, ms: 0 },
    pressed: false,
    fileState: 0,
    done: false,
  };
}

/**
 * The final state: every block, « 1er contact » validated, « Mandat » pending,
 * playhead at J8.6. Server HTML, no JavaScript, reduced motion, end of the play.
 */
export function finalFrame(): TimelineFrame {
  return frameAt(END_MS);
}

/** Time from step `index` to the next one (0 after the last). */
export function stepDelay(index: number): number {
  const current = STEP_TIMES[index];
  const next = STEP_TIMES[index + 1];
  return current === undefined || next === undefined ? 0 : next - current;
}

// ---------------------------------------------------------------------------
// Player: once per load, one timer at most, never requestAnimationFrame.

export type PlayerStatus = "idle" | "waiting" | "playing" | "done";
export type PlayerSnapshot = {
  status: PlayerStatus;
  /** Step shown while playing, or null (idle: initial frame; done: final frame). */
  index: number | null;
};

export type PlayerClock = {
  now: () => number;
  setTimeout: (callback: () => void, ms: number) => number;
  clearTimeout: (id: number) => void;
};

/** Beyond this lateness of a timer, the schedule restarts from now (ms): no burst of catch-up steps. */
const MAX_LATE_MS = 1000;

/**
 * Plays the timeline once: `trigger()` (frame seen) → 400 ms → steps → done.
 * Off screen or hidden tab during the play: it goes on to its end (≤ 3.8 s),
 * then nothing. `setReduced(true)` at any time jumps to the final state and
 * clears the timer. Never replays: a second trigger does nothing.
 */
export class ControlTimelinePlayer {
  private status: PlayerStatus = "idle";
  private index: number | null = null;
  private timer: number | null = null;
  private stepStartedAt = 0;

  constructor(
    private readonly clock: PlayerClock,
    private readonly onChange: (snapshot: PlayerSnapshot) => void,
  ) {}

  snapshot(): PlayerSnapshot {
    return { status: this.status, index: this.index };
  }

  /** True while a timer is armed (one at most). */
  hasTimer(): boolean {
    return this.timer !== null;
  }

  trigger(): void {
    if (this.status !== "idle") return;
    this.status = "waiting";
    this.arm(START_DELAY_MS, () => this.enter(0, this.clock.now()));
    this.emit();
  }

  setReduced(reduced: boolean): void {
    if (!reduced || this.status === "done") return;
    this.finish();
  }

  dispose(): void {
    this.clear();
  }

  private enter(index: number, startedAt: number): void {
    const now = this.clock.now();
    this.status = "playing";
    this.index = index;
    this.stepStartedAt = now - startedAt > MAX_LATE_MS ? now : startedAt;
    if (index >= STEP_TIMES.length - 1) {
      this.finish();
      return;
    }
    const ideal = this.stepStartedAt + stepDelay(index);
    this.arm(Math.max(0, ideal - now), () => this.enter(index + 1, ideal));
    this.emit();
  }

  private finish(): void {
    this.clear();
    this.status = "done";
    this.index = null;
    this.emit();
  }

  private arm(ms: number, callback: () => void): void {
    this.clear();
    this.timer = this.clock.setTimeout(() => {
      this.timer = null;
      callback();
    }, ms);
  }

  private clear(): void {
    if (this.timer !== null) this.clock.clearTimeout(this.timer);
    this.timer = null;
  }

  private emit(): void {
    this.onChange(this.snapshot());
  }
}

/** The frame of a snapshot: idle → initial, done → final, else the frame of the step. */
export function frameOf(snapshot: PlayerSnapshot): TimelineFrame {
  if (snapshot.status === "done") return finalFrame();
  if (snapshot.index === null) return initialFrame();
  return frameAt(STEP_TIMES[snapshot.index] ?? 0);
}
