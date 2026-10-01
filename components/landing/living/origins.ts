/**
 * Where a sequence of the network background starts (docs/design-system.md
 * §2.11.4): central neurons of the reference, away from the text blocks
 * (quiet zones) and from the opaque surfaces. Split from signals.ts.
 */

import type { Network } from "./network";
import { COVER_CLEARANCE, distanceToQuiet, ORIGIN_CLEARANCE, type QuietZones } from "./quiet";
import type { Random } from "./random";

/** Where the neurons are on screen at the start of a sequence (to pick its origin). */
export type OriginContext = {
  /** Screen x, y per node (CSS px). */
  screenX: ArrayLike<number>;
  screenY: ArrayLike<number>;
  width: number;
  height: number;
  zones: QuietZones;
  /** Opaque surfaces (cards, panels): an impulse born behind one would never be seen. */
  covers?: QuietZones;
};

/** Second beat of the arrival: at least this far (world units) from the first origin. */
export const SECOND_BEAT_DISTANCE = 0.9;
/** No origin under the white fade of the header (96 px, LivingBackground.module.css) + 24 px. */
export const ORIGIN_TOP = 120;

/**
 * Where an origin is searched, in order: the reference (central neurons of
 * the volume, |x| < 1.3, |y| < 0.85, z < 0.8, projected in the central 70 %
 * of the viewport); when the text blocks and the cards leave no such neuron
 * (the hero on a wide screen: title column on the left, journey card on the
 * right), any neuron projected in the viewport but a 4 % margin.
 */
export const ORIGIN_FRAMES: readonly { margin: number; central: boolean }[] = [
  { margin: 0.15, central: true },
  { margin: 0.04, central: false },
];

/**
 * Origins of a sequence: central neurons of the reference (|x| < 1.3,
 * |y| < 0.85, z < 0.8), not refractory, projected in the central 70 % of the
 * viewport (else any neuron in the viewport but a 4 % margin, ORIGIN_FRAMES),
 * ≥ 48 px from every quiet zone and ≥ 24 px outside every opaque surface; one
 * drawn (seeded) among the 3 farthest from them. A second origin lies ≥ 0.9
 * world units from the first.
 */
export function chooseOrigins(
  network: Network,
  context: OriginContext,
  refractory: Float64Array,
  now: number,
  random: Random,
  count: number,
): number[] {
  const origins: number[] = [];
  for (let k = 0; k < count; k++) {
    let eligible: { node: number; score: number }[] = [];
    for (const frame of ORIGIN_FRAMES) {
      eligible = eligibleOrigins(network, context, refractory, now, origins, frame.margin, frame.central);
      if (eligible.length > 0) break;
    }
    if (eligible.length === 0) break;
    eligible.sort((a, b) => b.score - a.score || a.node - b.node);
    const pool = eligible.slice(0, 3);
    origins.push(pool[Math.floor(random.next() * pool.length)]!.node);
  }
  return origins;
}

function eligibleOrigins(
  network: Network,
  context: OriginContext,
  refractory: Float64Array,
  now: number,
  origins: readonly number[],
  margin: number,
  central: boolean,
): { node: number; score: number }[] {
  const eligible: { node: number; score: number }[] = [];
  for (let node = 0; node < network.nodeCount; node++) {
    if (origins.includes(node)) continue;
    if (central && (Math.abs(network.nodeX[node]!) >= 1.3 || Math.abs(network.nodeY[node]!) >= 0.85 || network.nodeZ[node]! >= 0.8)) continue;
    if (now < refractory[node]!) continue;
    const x = context.screenX[node]!;
    const y = context.screenY[node]!;
    if (x < context.width * margin || x > context.width * (1 - margin)) continue;
    if (y < Math.max(context.height * margin, ORIGIN_TOP) || y > context.height * (1 - margin)) continue;
    const clearance = distanceToQuiet(context.zones, x, y);
    if (clearance < ORIGIN_CLEARANCE) continue;
    const covered = context.covers ? distanceToQuiet(context.covers, x, y) : Infinity;
    if (covered < COVER_CLEARANCE) continue;
    const tooClose = origins.some(
      (other) =>
        Math.hypot(
          network.nodeX[node]! - network.nodeX[other]!,
          network.nodeY[node]! - network.nodeY[other]!,
          network.nodeZ[node]! - network.nodeZ[other]!,
        ) < SECOND_BEAT_DISTANCE,
    );
    if (tooClose) continue;
    eligible.push({ node, score: Math.min(clearance, covered, context.width + context.height) });
  }
  return eligible;
}
