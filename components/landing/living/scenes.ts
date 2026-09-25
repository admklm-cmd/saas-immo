/**
 * Scenes of the landing "living background": one per section of the page.
 *
 * The background is an ILLUSTRATION (fictitious example, simulation). It never
 * reads any real state. It tells one story: request received → qualification →
 * follow-up → human validation → appointment → follow-up → mandate, and each
 * section of the landing shows one facet of it.
 *
 * Coordinates are normalised to the viewport (0..1). Every layout keeps the
 * path away from the text column of its section; what falls behind a card is
 * partly hidden on purpose.
 */

import { AGENTS_MESH_STYLE, type MeshLook, type MeshStyle } from "./mesh-style";

export const LIVING_SCENES = ["hero", "probleme", "solution", "agents", "controle", "resultat", "final"] as const;
export type LivingScene = (typeof LIVING_SCENES)[number];

export function isLivingScene(value: string | undefined | null): value is LivingScene {
  return (LIVING_SCENES as readonly string[]).includes(value ?? "");
}

/** Stops of the path: entry, Léa, Hugo, Emma, human gate, Louis, Sarah, mandate. */
export const STOP_COUNT = 8;
export const ENTRY_STOP = 0;
export const GATE_STOP = 4;
export const GOAL_STOP = 7;
/** Stop index → agent index (0 = Léa … 4 = Sarah), or -1 for the other stops. */
export const STOP_AGENT = [-1, 0, 1, 2, -1, 3, 4, -1] as const;

export type Point = readonly [number, number];

/**
 * A zone where some ambient prospects rest (normalised to the viewport, like
 * the stops). `share` is the part of the prospects placed there; `sway` scales
 * their wandering (1 = as everywhere else), so a narrow zone keeps its points.
 * Shares are relative weights (they need not add up to 1).
 */
export type FieldZone = { x0: number; y0: number; x1: number; y1: number; share: number; sway?: number };

/**
 * An element of a section (normalised to the scene frame, desktop, reading
 * position). `text`: no mesh line may cross it (title, introduction, text of
 * the modules); otherwise a surface lines may pass behind (a frosted module).
 * Impulses keep off every element.
 */
export type ContentZone = { x0: number; y0: number; x1: number; y1: number; text: boolean };

export type SceneSpec = {
  /** 8 stops, desktop and tablet (≥ 768 px). */
  wide: readonly Point[];
  /** 8 stops, mobile: a quiet column along the right edge. */
  compact: readonly Point[];
  /** Seconds between two fictitious files entering the path (per lane). */
  period: number;
  /** Parallel clean paths drawn at once (result section). */
  lanes: number;
  /** Distance between two lanes, CSS px. */
  laneGap: number;
  /** Share of files stopped by a guard rail (drawn as a halted impulse). */
  blockRate: number;
  /** Share of files lost mid-way without explanation (problem section only). */
  lostRate: number;
  /** Share of files duplicated by a second entry (problem section only). */
  duplicateRate: number;
  /** Wandering of the stops, CSS px (problem section only). */
  scatter: number;
  /** Links drawn with gaps: the path is interrupted. */
  broken: boolean;
  /** Seconds a file waits in front of the human validation. */
  gateHold: number;
  /** Agents light up one after another. */
  spotlight: boolean;
  /** Stops appear and connect one after another when the scene starts. */
  build: boolean;
  /** Ambient prospects drift towards the entry (false: they wander). */
  inflow: boolean;
  /**
   * Visual presence of the network (1 = reference rendering). Scales the
   * opacity of links, nodes and prospects, the size of some nodes and the
   * frequency of impulses. Only the problem and agents scenes raise it; every
   * other scene keeps exactly 1, hence exactly the reference rendering.
   */
  presence: number;
  /**
   * Weight of the mesh (0..1): ambient prospects linked to their neighbours and
   * to the path, slow cobalt impulses along a few links, light scroll parallax.
   * Only the problem and agents scenes draw it; every other scene keeps 0,
   * hence exactly the reference rendering.
   */
  mesh: number;
  /**
   * Desktop only: zones where the ambient prospects (hence the mesh vertices)
   * rest, instead of the box around the stops. Lets a scene keep its network
   * in the free space AROUND and BETWEEN the elements of its section. Only the
   * agents scene sets it; every other scene keeps the box (reference rendering).
   */
  field?: readonly FieldZone[];
  /**
   * Desktop only: reference frame of the layouts, CSS px. On a larger screen
   * the layouts keep this size, centred horizontally and anchored at the top,
   * like the content (max width): the composition measured at this size stays
   * next to the same elements. Only the agents scene sets it.
   */
  frame?: { width: number; height: number };
  /**
   * Style profile of the mesh (mesh-style.ts). Absent: the reference mesh of
   * C1 (problem scene). Only the agents scene sets it.
   */
  meshStyle?: MeshStyle;
  /** Desktop only: elements of the section the mesh keeps clear of (see ContentZone). */
  content?: readonly ContentZone[];
};

const BASE: SceneSpec = {
  wide: [],
  compact: [],
  period: 3.2,
  lanes: 1,
  laneGap: 0,
  blockRate: 0.14,
  lostRate: 0,
  duplicateRate: 0,
  scatter: 0,
  broken: false,
  gateHold: 1.8,
  spotlight: false,
  build: false,
  inflow: true,
  presence: 1,
  mesh: 0,
};

/** Presence of the problem and agents scenes: about a third more visible. */
export const RAISED_PRESENCE = 1.35;
/** Phones keep half of the extra presence: a quieter, less dense network. */
export const COMPACT_PRESENCE_GAIN = 0.5;

/** Presence actually applied for a scene on a given screen. */
export function presenceOf(spec: SceneSpec, compact: boolean): number {
  return compact ? 1 + (spec.presence - 1) * COMPACT_PRESENCE_GAIN : spec.presence;
}

/**
 * Narrowest viewport (CSS px) drawing a scene frame at its pixel size: the
 * landing content is 1280 px wide at most (max-w-7xl), centred, so from there
 * its elements sit at the same pixels relative to the centre.
 */
export const FRAME_PIXEL_MIN = 1280;

/** Size and offset of the box a scene's normalised coordinates are drawn in, CSS px. */
export function frameOf(
  spec: SceneSpec,
  viewport: { width: number; height: number; compact: boolean },
): { x: number; width: number; height: number } {
  const frame = viewport.compact ? undefined : spec.frame;
  if (!frame) return { x: 0, width: viewport.width, height: viewport.height };
  // From FRAME_PIXEL_MIN px wide the content (max width, centred) sits at the
  // same pixels relative to the centre as at the reference size: the frame
  // keeps its pixel size, centred (it may overflow the viewport a little).
  if (viewport.width >= FRAME_PIXEL_MIN) {
    return { x: (viewport.width - frame.width) / 2, width: frame.width, height: frame.height };
  }
  const width = Math.min(viewport.width, frame.width);
  return { x: (viewport.width - width) / 2, width, height: Math.min(viewport.height, frame.height) };
}

/** Mesh look of a scene on a given screen, or null (reference mesh). */
export function meshLookOf(scene: LivingScene, compact: boolean): MeshLook | null {
  const style = SCENES[scene].meshStyle;
  return style ? (compact ? style.compact : style.wide) : null;
}

/** Elements a scene's mesh keeps clear of on this screen (desktop only), CSS px. */
export function contentOf(
  scene: LivingScene,
  viewport: { width: number; height: number; compact: boolean },
): readonly ContentZone[] {
  const content = SCENES[scene].content;
  if (viewport.compact || !content) return [];
  const frame = frameOf(SCENES[scene], viewport);
  return content.map((zone) => ({
    x0: frame.x + zone.x0 * frame.width,
    y0: zone.y0 * frame.height,
    x1: frame.x + zone.x1 * frame.width,
    y1: zone.y1 * frame.height,
    text: zone.text,
  }));
}

/** Mesh weight actually applied: phones keep half of it, like the presence. */
export function meshOf(spec: SceneSpec, compact: boolean): number {
  return compact ? spec.mesh * COMPACT_PRESENCE_GAIN : spec.mesh;
}

/** Mobile: one discreet column on the right edge, below the header. */
const COMPACT_COLUMN: readonly Point[] = [
  [0.95, 0.99],
  [0.9, 0.9],
  [0.95, 0.8],
  [0.9, 0.7],
  [0.95, 0.6],
  [0.9, 0.5],
  [0.95, 0.4],
  [0.9, 0.3],
];

export const SCENES: Record<LivingScene, SceneSpec> = {
  // The five agents appear and connect around the demonstration card.
  hero: {
    ...BASE,
    wide: [
      [0.47, 0.99],
      [0.56, 0.93],
      [0.7, 0.965],
      [0.86, 0.93],
      [0.965, 0.72],
      [0.965, 0.44],
      [0.9, 0.16],
      [0.72, 0.13],
    ],
    compact: COMPACT_COLUMN,
    build: true,
  },
  // Depth behind the problem section: a calm network that breathes around the
  // heading and the chart surface (seen blurred through it), with a few cobalt
  // impulses, some lost or duplicated on the way (links drawn with gaps).
  probleme: {
    ...BASE,
    wide: [
      [0.58, 0.12],
      [0.7, 0.21],
      [0.83, 0.1],
      [0.93, 0.24],
      [0.97, 0.47],
      [0.87, 0.63],
      [0.96, 0.8],
      [0.78, 0.9],
    ],
    compact: [
      [0.93, 0.95],
      [0.87, 0.83],
      [0.96, 0.74],
      [0.89, 0.61],
      [0.96, 0.5],
      [0.88, 0.41],
      [0.95, 0.3],
      [0.9, 0.2],
    ],
    period: 2.8,
    blockRate: 0,
    lostRate: 0.3,
    duplicateRate: 0.15,
    scatter: 9,
    broken: true,
    gateHold: 0.9,
    inflow: false,
    presence: RAISED_PRESENCE,
    mesh: 1,
  },
  // The same flow, reorganised: one clean curve.
  solution: {
    ...BASE,
    wide: [
      [0.54, 0.52],
      [0.6, 0.36],
      [0.67, 0.24],
      [0.74, 0.2],
      [0.8, 0.24],
      [0.86, 0.34],
      [0.92, 0.44],
      [0.965, 0.52],
    ],
    compact: COMPACT_COLUMN,
    period: 2.8,
    blockRate: 0.08,
  },
  // Agents activate one after another, around and between the elements of the
  // section, measured at 1440 × 900 at the reading position (section top 120 px
  // above the viewport: title lines up to x 758 / y 276, text up to y 338, bar
  // y 405–441 with the navigation from x 1160, modules y 468–680 separated by
  // 12 px gaps centred on x 342, 562, 782, 982 and 1202, detail text and scene
  // window from y 723, window right edge x 1312). The path stays right of the
  // title column (x ≥ 0.68, clear of it at every scroll position, 1280 to
  // 1920 px wide): Léa, Hugo, Emma beside the title, the human validation above
  // the gap at x 1202, down between two modules to Louis, along the band between
  // the modules and the window to Sarah, and back up between two other modules
  // to the mandate.
  agents: {
    ...BASE,
    wide: [
      [0.66, 0.1056],
      [0.6875, 0.1333],
      [0.7083, 0.2056],
      [0.6875, 0.2778],
      [0.7083, 0.3533],
      [0.6875, 0.4311],
      [0.6819, 0.488],
      [0.6819, 0.7778],
    ],
    compact: COMPACT_COLUMN,
    frame: { width: 1440, height: 900 },
    // C3: the network breathes through the whole section, around the content
    // (a third of it right of the title, the rest in bands and margins that
    // wrap the heading, the modules and the window), never under a text.
    field: [
      // Right of the title and the introduction, below the fixed header.
      { x0: 0.57, y0: 0.085, x1: 0.99, y1: 0.43, share: 0.34 },
      // Full-width band between the introduction and the bar.
      { x0: 0.015, y0: 0.392, x1: 0.8, y1: 0.445, share: 0.15, sway: 0.35 },
      // Left and right margins, top to bottom.
      { x0: 0.008, y0: 0.085, x1: 0.07, y1: 0.97, share: 0.08, sway: 0.5 },
      { x0: 0.93, y0: 0.47, x1: 0.995, y1: 0.97, share: 0.06, sway: 0.5 },
      // Band between the modules and the scene window, open around « Mandat ».
      { x0: 0.02, y0: 0.762, x1: 0.655, y1: 0.795, share: 0.1, sway: 0.3 },
      { x0: 0.75, y0: 0.762, x1: 0.98, y1: 0.795, share: 0.04, sway: 0.3 },
      // Chains through the gaps between modules (the path uses the one at x 982)
      // and between the detail text and the window: short vertical hairlines.
      { x0: 0.2375, y0: 0.47, x1: 0.2375, y1: 0.8, share: 0.025, sway: 0.15 },
      { x0: 0.3903, y0: 0.47, x1: 0.3903, y1: 0.8, share: 0.025, sway: 0.15 },
      { x0: 0.5431, y0: 0.47, x1: 0.5431, y1: 0.8, share: 0.025, sway: 0.15 },
      { x0: 0.8347, y0: 0.47, x1: 0.8347, y1: 0.8, share: 0.025, sway: 0.15 },
      { x0: 0.4208, y0: 0.815, x1: 0.4208, y1: 0.99, share: 0.025, sway: 0.15 },
    ],
    // Elements of the section at the reading position (same measure as above).
    content: [
      { x0: 0, y0: 0, x1: 1, y1: 0.0711, text: false },
      { x0: 0.0889, y0: 0.0511, x1: 0.5278, y1: 0.3067, text: true },
      { x0: 0.0889, y0: 0.3233, x1: 0.5417, y1: 0.3756, text: true },
      { x0: 0.0889, y0: 0.4589, x1: 0.3653, y1: 0.48, text: true },
      { x0: 0.8056, y0: 0.45, x1: 0.9111, y1: 0.49, text: true },
      { x0: 0.0889, y0: 0.52, x1: 0.2333, y1: 0.7533, text: true },
      { x0: 0.2417, y0: 0.52, x1: 0.3861, y1: 0.7533, text: true },
      { x0: 0.3944, y0: 0.52, x1: 0.5389, y1: 0.7533, text: true },
      { x0: 0.5472, y0: 0.52, x1: 0.6778, y1: 0.7533, text: true },
      { x0: 0.6861, y0: 0.52, x1: 0.8306, y1: 0.7533, text: true },
      { x0: 0.8389, y0: 0.52, x1: 0.9167, y1: 0.7533, text: true },
      { x0: 0.0889, y0: 0.8033, x1: 0.4042, y1: 1, text: true },
      { x0: 0.4375, y0: 0.8033, x1: 0.9111, y1: 1, text: true },
    ],
    meshStyle: AGENTS_MESH_STYLE,
    // Calm: agents light up in turn (cobalt pulses), few impulses, rare halts.
    period: 4.2,
    blockRate: 0.06,
    spotlight: true,
    presence: RAISED_PRESENCE,
    mesh: 1,
  },
  // Every file stops in front of the human validation, then resumes.
  controle: {
    ...BASE,
    wide: [
      [0.52, 0.42],
      [0.58, 0.3],
      [0.66, 0.24],
      [0.74, 0.28],
      [0.8, 0.36],
      [0.86, 0.28],
      [0.92, 0.22],
      [0.97, 0.3],
    ],
    compact: COMPACT_COLUMN,
    period: 3,
    blockRate: 0.2,
    gateHold: 3.4,
  },
  // Several clean paths at the same time.
  resultat: {
    ...BASE,
    wide: [
      [0.53, 0.2],
      [0.6, 0.26],
      [0.67, 0.22],
      [0.74, 0.28],
      [0.8, 0.24],
      [0.86, 0.3],
      [0.92, 0.26],
      [0.975, 0.32],
    ],
    compact: COMPACT_COLUMN,
    period: 3.4,
    lanes: 3,
    laneGap: 26,
    blockRate: 0.06,
    gateHold: 1.2,
  },
  // Everything converges into one point, next to the final call to action.
  final: {
    ...BASE,
    wide: [
      [0.58, 0.18],
      [0.93, 0.26],
      [0.94, 0.72],
      [0.64, 0.8],
      [0.62, 0.42],
      [0.86, 0.38],
      [0.84, 0.6],
      [0.76, 0.5],
    ],
    compact: [
      [0.95, 0.3],
      [0.84, 0.4],
      [0.95, 0.52],
      [0.84, 0.64],
      [0.95, 0.74],
      [0.86, 0.84],
      [0.95, 0.9],
      [0.9, 0.97],
    ],
    period: 2.6,
    blockRate: 0.05,
    gateHold: 1.4,
  },
};
