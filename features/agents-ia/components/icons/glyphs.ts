/**
 * Custom glyph family of Ascend (docs/design-system.md §2.8).
 *
 * Drawn by hand on ONE grid, like a system symbol set:
 *   * a 24 × 24 viewBox, live area 3–21, optical centre 12;
 *   * one stroke weight (1.75 on the grid: about 1 px at 14 px, 1.2 px at 16 px);
 *   * round caps and round joins, no fill: the symbol is painted with
 *     `currentColor`, so it inverts with the surface it sits on;
 *   * simple geometry (arcs, straight segments), readable from 14 px.
 *
 * Each glyph is split in two layers: `paths` (the body, still) and `accent`
 * (the part that says the job, and the only part that moves). The motion is
 * named, never free-form: `drop` (comes in from above), `nudge` (moves
 * forward), `pop` (a short scale) or `draw` (the stroke is traced). The motion
 * only runs on hover or on activation, and never under reduced motion.
 *
 * Every string below is path data only: no colour, no width, no transform.
 * `glyphs.test.ts` checks the rendered family.
 */

export const GLYPH_VIEWBOX = "0 0 24 24";
export const GLYPH_STROKE_WIDTH = 1.75;

export type GlyphMotion = "drop" | "nudge" | "pop" | "draw";

export type GlyphDefinition = {
  /** Still body of the symbol. */
  paths: readonly string[];
  /** The part that carries the job, and moves (see `motion`). */
  accent: readonly string[];
  motion: GlyphMotion;
};

/** Circle of radius `r` centred on (`cx`, `cy`), as path data (two arcs). */
function circle(cx: number, cy: number, r: number): string {
  return `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${r * 2} 0a${r} ${r} 0 1 0 ${-r * 2} 0`;
}

export const GLYPHS = {
  // --- Agents ------------------------------------------------------------------
  /** Léa, acquisition: a contact comes into the agency's tray. */
  lea: {
    paths: [
      "M3.75 13.5v3.75a2.75 2.75 0 0 0 2.75 2.75h11a2.75 2.75 0 0 0 2.75-2.75V13.5",
      "M3.75 13.5h4.1l1.5 2.25h5.3l1.5-2.25h4.1",
    ],
    accent: ["M12 3.75v7.75", "M8.75 8.25 12 11.5l3.25-3.25"],
    motion: "drop",
  },
  /** Hugo, qualification: the lens that examines, and what it validates. */
  hugo: {
    paths: [circle(10.75, 10.75, 6.75), "M15.75 15.75 20.25 20.25"],
    accent: ["M7.9 10.9l1.95 1.95 3.4-3.4"],
    motion: "pop",
  },
  /** Emma, relation: a message, its lines being written. */
  emma: {
    paths: [
      "M6.5 4.75h11a2.75 2.75 0 0 1 2.75 2.75v6.25a2.75 2.75 0 0 1-2.75 2.75H12.5l-4.25 3.5v-3.5H6.5a2.75 2.75 0 0 1-2.75-2.75V7.5A2.75 2.75 0 0 1 6.5 4.75z",
    ],
    accent: ["M8 9.25h8", "M8 12.25h5"],
    motion: "draw",
  },
  /** Louis, appointment: a calendar page and the one slot proposed. */
  louis: {
    paths: [
      "M6.25 5.75h11.5a2.5 2.5 0 0 1 2.5 2.5v9.5a2.5 2.5 0 0 1-2.5 2.5H6.25a2.5 2.5 0 0 1-2.5-2.5v-9.5a2.5 2.5 0 0 1 2.5-2.5z",
      "M8.25 3.75v4",
      "M15.75 3.75v4",
      "M3.75 10.5h16.5",
    ],
    accent: ["M13.75 14.25h2.25v2.25h-2.25z"],
    motion: "pop",
  },
  /** Sarah, follow-up: the dossier, and the file moving forward. */
  sarah: {
    paths: [
      "M3.75 7.5A2.25 2.25 0 0 1 6 5.25h3.4l2 2.25H18a2.25 2.25 0 0 1 2.25 2.25v8A2.25 2.25 0 0 1 18 20H6a2.25 2.25 0 0 1-2.25-2.25z",
    ],
    accent: ["M8.25 13.75h6.75", "M12.75 11.25l2.5 2.5-2.5 2.5"],
    motion: "nudge",
  },

  // --- Human steps and other stages of a dossier ----------------------------------
  /** Human validation: a person, and the decision taken. */
  human: {
    paths: [circle(10, 7.75, 3.5), "M3.75 19.75c.6-3.4 3.2-5.5 6.25-5.5 1.45 0 2.8.45 3.9 1.3"],
    accent: ["M15 17.75l2 2 3.5-3.5"],
    motion: "pop",
  },
  /** Mandate: the document, and the signature traced by a person. */
  mandate: {
    paths: [
      "M13.75 3.75h-6.5A2.25 2.25 0 0 0 5 6v12a2.25 2.25 0 0 0 2.25 2.25h9.5A2.25 2.25 0 0 0 19 18V9z",
      "M13.75 3.75V9H19",
    ],
    accent: ["M8.25 16.5c.9-1.6 1.8-2 2.3-.9.4.9.9 1.2 1.6.3.6-.8 1.2-.8 1.8-.1.4.5 1 .6 1.8.3"],
    motion: "draw",
  },
  /** Prospect: the seller, before anything is done. */
  prospect: {
    paths: ["M5 20c.8-3.6 3.6-5.75 7-5.75S18.2 16.4 19 20"],
    accent: [circle(12, 8, 3.75)],
    motion: "pop",
  },
  /** Appointment: the place of the estimation visit. */
  appointment: {
    paths: ["M12 20.5s-6.25-5.4-6.25-10.5a6.25 6.25 0 0 1 12.5 0c0 5.1-6.25 10.5-6.25 10.5z"],
    accent: [circle(12, 10, 2.25)],
    motion: "drop",
  },

  // --- Utility symbols of the illustrations (same grid, same weight) -------------
  check: { paths: [], accent: ["M5.5 12.5l4 4 9-9"], motion: "draw" },
  arrowRight: { paths: ["M4.75 12h14.5"], accent: ["M13.5 6.25 19.25 12l-5.75 5.75"], motion: "nudge" },
  arrowLeft: { paths: ["M19.25 12H4.75"], accent: ["M10.5 6.25 4.75 12l5.75 5.75"], motion: "nudge" },
  arrowDown: { paths: ["M12 4.75v14.5"], accent: ["M6.25 13.5 12 19.25l5.75-5.75"], motion: "drop" },
  lock: {
    paths: [
      "M6.5 10.75h11a1.75 1.75 0 0 1 1.75 1.75v6a1.75 1.75 0 0 1-1.75 1.75h-11a1.75 1.75 0 0 1-1.75-1.75v-6a1.75 1.75 0 0 1 1.75-1.75z",
    ],
    accent: ["M8 10.75V8a4 4 0 0 1 8 0v2.75"],
    motion: "drop",
  },
  clock: { paths: [circle(12, 12, 8.25)], accent: ["M12 7.5V12l3 2"], motion: "pop" },
  document: {
    paths: [
      "M13.75 3.75h-6.5A2.25 2.25 0 0 0 5 6v12a2.25 2.25 0 0 0 2.25 2.25h9.5A2.25 2.25 0 0 0 19 18V9z",
      "M13.75 3.75V9H19",
    ],
    accent: ["M8.75 13h6.5", "M8.75 16.25h4"],
    motion: "draw",
  },
  merge: {
    paths: ["M4.75 5.5c0 4 3 6.5 7 6.5", "M4.75 18.5c0-4 3-6.5 7-6.5"],
    accent: ["M11.75 12h7.5", "M16.25 9 19.25 12l-3 3"],
    motion: "nudge",
  },
  question: {
    paths: [circle(12, 12, 8.25)],
    accent: ["M9.6 9.6a2.5 2.5 0 1 1 3.4 2.35c-.6.25-1 .8-1 1.45v.35", "M12 16.6v.01"],
    motion: "pop",
  },
  mail: {
    paths: [
      "M5.75 5.75h12.5a2 2 0 0 1 2 2v8.5a2 2 0 0 1-2 2H5.75a2 2 0 0 1-2-2v-8.5a2 2 0 0 1 2-2z",
    ],
    accent: ["M4.5 7.5 12 13l7.5-5.5"],
    motion: "drop",
  },

  // --- Navigation of the signed-in space (same grid, same weight) ------------------
  /** Dashboard: the agency at a glance, one pane standing out. */
  dashboard: {
    paths: [
      "M5.75 3.75h3a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-3a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2z",
      "M5.75 15.75h3a2 2 0 0 1 2 2v.5a2 2 0 0 1-2 2h-3a2 2 0 0 1-2-2v-.5a2 2 0 0 1 2-2z",
      "M15.25 3.75h3a2 2 0 0 1 2 2v.5a2 2 0 0 1-2 2h-3a2 2 0 0 1-2-2v-.5a2 2 0 0 1 2-2z",
    ],
    accent: ["M15.25 11.25h3a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-3a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2z"],
    motion: "pop",
  },
  /** Pipeline: stages on one line, the dossier moving to the next one. */
  pipeline: {
    paths: [circle(5.5, 12, 1.75), circle(12, 12, 1.75), "M7.25 12h3", "M13.75 12h3"],
    accent: [circle(18.5, 12, 1.75)],
    motion: "nudge",
  },
  /** Tasks: one line done, one still open. */
  tasks: {
    paths: [
      "M5.25 14.25h2a1.5 1.5 0 0 1 1.5 1.5v2a1.5 1.5 0 0 1-1.5 1.5h-2a1.5 1.5 0 0 1-1.5-1.5v-2a1.5 1.5 0 0 1 1.5-1.5z",
      "M12 7.25h8.25",
      "M12 16.75h8.25",
    ],
    accent: ["M3.75 7.25l2 2 3.75-4"],
    motion: "draw",
  },
  /** AI agents at a glance: modules linked to one active node. */
  network: {
    paths: [circle(6, 6.5, 2.25), circle(6, 17.5, 2.25), "M8.1 7.55l6.8 3.25", "M8.1 16.45l6.8-3.25"],
    accent: [circle(17.5, 12, 2.75)],
    motion: "pop",
  },
  /** Settings: two sliders, each set by hand. */
  settings: {
    paths: ["M3.75 7.25h6.5", "M14.75 7.25h5.5", "M3.75 16.75h2.5", "M10.75 16.75h9.5"],
    accent: [circle(12.5, 7.25, 2.25), circle(8.5, 16.75, 2.25)],
    motion: "nudge",
  },
  /** Menu of the compact navigation. */
  menu: {
    paths: ["M4.75 8h14.5", "M4.75 16h14.5"],
    accent: [],
    motion: "pop",
  },
  /** Close the compact navigation. */
  close: {
    paths: [],
    accent: ["M6.5 6.5l11 11", "M17.5 6.5l-11 11"],
    motion: "pop",
  },

  // --- Pipeline -----------------------------------------------------------------
  /** Change the stage of a dossier: its node on the line, sent along it. */
  stageMove: {
    paths: [circle(6, 12, 2.25), "M8.25 12h10.5"],
    accent: ["M15 8.25 18.75 12 15 15.75"],
    motion: "nudge",
  },
} as const satisfies Record<string, GlyphDefinition>;

export type GlyphName = keyof typeof GLYPHS;

/** Glyphs of the actors and stages of a dossier (carousel and operational rail). */
export const STAGE_GLYPHS = [
  "lea",
  "hugo",
  "emma",
  "louis",
  "sarah",
  "human",
  "mandate",
  "prospect",
  "appointment",
] as const satisfies readonly GlyphName[];

export const GLYPH_NAMES = Object.keys(GLYPHS) as GlyphName[];
