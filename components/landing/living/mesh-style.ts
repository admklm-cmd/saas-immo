/**
 * Style profile of a scene's mesh (see mesh.ts). A scene without profile draws
 * the reference mesh of C1 (problem scene: hairlines capped at 0.08, vertex
 * dots only where a prospect left, single-link impulses). A scene with a
 * profile (agents only, C3) draws a denser, clearly readable network:
 *
 * - more vertices, every one drawn (small grey dots, a few outlined hubs), on
 *   a near and a far plane;
 * - grey hairlines whose opacity depends on the plane and on the length;
 * - cobalt impulses that travel a short ROUTE of a few links, with a short
 *   tail in segments of decreasing opacity, and briefly light the vertex they
 *   reach. Still at most `PULSES.wide` at once; no glow, no gradient, no blur.
 *
 * Opacities are given before the page intensity (`REST_INTENSITY` = 0.72 at
 * rest), at full scene weight. Pure data: no import, no side effect.
 */

export type MeshLook = {
  /** Mesh vertices (ambient prospects). */
  points: number;
  /** Most links drawn. */
  links: number;
  /** Neighbours linked to each vertex, and share of vertices linked to one more. */
  neighbours: number;
  thirdShare: number;
  /** A vertex links to the nearest stop within this distance, CSS px. */
  stopReach: number;
  /** Longest link kept, CSS px (no long line across the content). */
  maxLength: number;
  /** Opacity kept from `fade[0]` px (full) down to `longFade` of it at `fade[1]` px. */
  fade: readonly [number, number];
  longFade: number;
  /** Share of prospects drifting towards the entry, and only within this distance of it, CSS px. */
  inflowShare: number;
  inflowReach: number;
  /** Hairlines: opacity of the near and far planes, widths, CSS px. */
  line: number;
  farLine: number;
  width: number;
  farWidth: number;
  /** Vertex dots: opacity (near, far), radius range of the near plane, far radius. */
  point: number;
  farPoint: number;
  radius: readonly [number, number];
  farRadius: number;
  /** Hubs (near plane only): share, radius of the outlined circle, opacity of its outline. */
  hubShare: number;
  hubRadius: number;
  hub: number;
  /** Impulses at once, seconds between two departures of a slot, speed px/s, links per route. */
  pulses: number;
  period: number;
  speed: number;
  hops: number;
  /** Impulse dot: opacity, radius; tail: length px, segments, width of its first segment. */
  pulse: number;
  pulseRadius: number;
  trail: number;
  trailSegments: number;
  trailWidth: number;
  /** Cobalt of a vertex reached by an impulse: opacity, duration in seconds. */
  flash: number;
  flashSeconds: number;
};

export type MeshStyle = { wide: MeshLook; compact: MeshLook };

/**
 * Agents scene (C3, validated on 25/09/2026). Desktop: ~100 vertices around
 * and between the elements of the section, hairlines at about 0.15 to 0.30 of
 * final opacity, dots at about 0.25 to 0.45, three impulses at most. Phones:
 * a sober right column, a little more present than before, one impulse.
 */
export const AGENTS_MESH_STYLE: MeshStyle = {
  wide: {
    points: 116,
    links: 260,
    neighbours: 2,
    thirdShare: 0.6,
    stopReach: 150,
    maxLength: 240,
    fade: [90, 240],
    longFade: 0.55,
    inflowShare: 0.5,
    inflowReach: 360,
    line: 0.4,
    farLine: 0.24,
    width: 0.95,
    farWidth: 0.7,
    point: 0.62,
    farPoint: 0.36,
    radius: [1.5, 2.3],
    farRadius: 1.2,
    hubShare: 0.1,
    hubRadius: 3.4,
    hub: 0.72,
    pulses: 3,
    period: 4,
    speed: 64,
    hops: 4,
    pulse: 1.32,
    pulseRadius: 2.4,
    trail: 30,
    trailSegments: 4,
    trailWidth: 1.8,
    flash: 1.1,
    flashSeconds: 0.7,
  },
  compact: {
    points: 26,
    links: 42,
    neighbours: 2,
    thirdShare: 0.35,
    stopReach: 80,
    maxLength: 150,
    fade: [60, 150],
    longFade: 0.5,
    inflowShare: 0.6,
    inflowReach: Infinity,
    line: 0.24,
    farLine: 0.15,
    width: 0.8,
    farWidth: 0.6,
    point: 0.42,
    farPoint: 0.26,
    radius: [1.2, 1.7],
    farRadius: 1,
    hubShare: 0.08,
    hubRadius: 2.8,
    hub: 0.5,
    pulses: 1,
    period: 5.5,
    speed: 60,
    hops: 3,
    pulse: 1.1,
    pulseRadius: 1.8,
    trail: 20,
    trailSegments: 3,
    trailWidth: 1.4,
    flash: 0.8,
    flashSeconds: 0.6,
  },
};
