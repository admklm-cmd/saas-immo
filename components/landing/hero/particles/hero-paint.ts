import { SPHERE_OPACITY, CONTACT_SWELL, HANDS_EMPHASIS, HANDS_GROWTH, HANDS_POINT_MAX, LIVE_CYCLE, MESSENGER, BEAD_RING, BEAD_TRAIL, ORBIT_PORT, PLANES, RING, ROBOT_PORT } from "./hero-config";
import { CLASS_COUNT, HeroScene } from "./HeroScene";
import { roleOf } from "./hands-robots";
import type { RobotPose } from "./robots";
import { handsShareAt } from "./timeline";
import { easeInOutSine } from "./trajectory";

/**
 * What the hero canvas draws, apart from the loop (docs/design-system.md §2.11.4 ter G, S.6): the
 * points by depth plane, the robots (with the trail of the circulants and the cobalt port of the
 * left messenger), the cobalt contact point, its ring and its bit. Every colour comes from the CSS
 * tokens of the canvas; nothing is red or orange and nothing glows.
 */
export type Palette = { readonly ink: string; readonly canvas: string; readonly accent: string };

/** What was drawn in the last image (published as test attributes). */
export type PaintStats = { robots: number; cobalt: number; /** Beads drawn on the rails (U.6). */ beads: number };

const ghost: RobotPose = { x: 0, y: 0, z: 0, alpha: 0, accent: false, bead: false };

/** Share of the hands in the image: 0 on the big sphere, rising smoothly over the wave, 1 after it (or on a still image). */
export function handsShareOf(sequenceMs: number, still: boolean): number {
  return still ? 1 : handsShareAt(sequenceMs);
}

/** Share of the « hands look » (stronger, larger points): follows the share of the hands. Points only. */
export function lookShareOf(sequenceMs: number, still: boolean): number {
  return handsShareOf(sequenceMs, still);
}

/**
 * The points: planes by classes (quiet zone, skin fade), one fill each. `look` is the share of the hands
 * look; the points of the big sphere are larger (`sphereGrowth`), the more so the sphere is still alone.
 */
export function paintPoints(ctx: CanvasRenderingContext2D, scene: HeroScene, palette: Palette, look: number, sphereWeight: number, birth: number): void {
  // The big sphere is drawn stronger too (SPHERE_OPACITY): it has to read as a full ball behind the texts.
  const opacity = birth * (1 + look * HANDS_EMPHASIS) * (1 + (SPHERE_OPACITY - 1) * sphereWeight);
  const grow = (1 + look * HANDS_GROWTH * (scene.tier.name === "phone" ? 0.4 : 1)) * (1 + (scene.tier.sphereGrowth - 1) * sphereWeight);
  ctx.fillStyle = palette.ink;
  for (let b = 0; b < PLANES.length; b++) {
    const plane = PLANES[b]!;
    const size = Math.min(plane.size * grow * scene.tier.pointScale, HANDS_POINT_MAX);
    const half = size / 2;
    for (let c = 0; c < CLASS_COUNT; c++) {
      const bucket = b * CLASS_COUNT + c;
      const count = scene.bucketSize[bucket]!;
      if (count === 0) continue;
      const list = scene.buckets[bucket]!;
      ctx.globalAlpha = Math.min(1, plane.alpha * opacity * HeroScene.classAlpha(c));
      ctx.beginPath();
      for (let k = 0; k < count; k++) {
        const i = list[k]!;
        ctx.rect(scene.x[i]! - half, scene.y[i]! - half, size, size);
      }
      ctx.fill();
    }
  }
}

/** Cobalt marks kept in reserve for the contact point, its ring and its bit (they are drawn after the beads). */
const COBALT_RESERVE = 3;

type Bead = { x: number; y: number; alpha: number; cobalt: boolean; index: number; trail: boolean };
const beads: Bead[] = Array.from({ length: 64 }, () => ({ x: 0, y: 0, alpha: 0, cobalt: false, index: 0, trail: false }));

/** One round bead: a disc (cobalt, or canvas white ringed by a hairline of ink) at `alpha`, radius `radius` (CSS px). */
function disc(ctx: CanvasRenderingContext2D, palette: Palette, x: number, y: number, radius: number, alpha: number, cobalt: boolean): void {
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.globalAlpha = alpha;
  if (cobalt) {
    ctx.fillStyle = palette.accent;
    ctx.fill();
    return;
  }
  ctx.fillStyle = palette.canvas;
  ctx.fill();
  ctx.globalAlpha = alpha * BEAD_RING.alpha;
  ctx.strokeStyle = palette.ink;
  ctx.lineWidth = BEAD_RING.width;
  ctx.stroke();
}

/**
 * The beads of the rails (U.6): round, fine pearls with a thin trail of ghosts of their own colour. A cobalt
 * bead is a full disc; a « white » bead is a white disc ringed by a hairline of ink (a fine bubble on the white
 * page, a clear spark on the dark points of the hands). Trail first (farthest ghost to nearest), then the heads.
 */
function paintBeads(ctx: CanvasRenderingContext2D, scene: HeroScene, palette: Palette, count: number, stats: PaintStats): void {
  const tier = scene.tier;
  const { ghosts, gap } = tier.beadTrail;
  const unit = tier.beadSize / 3;
  const cobaltRoom = Math.max(0, tier.cobaltCap - COBALT_RESERVE);
  let cobalts = 0;
  for (let k = 0; k < count; k++) {
    const bead = beads[k]!;
    // The cap is a ceiling: the cobalt beads in excess are drawn white.
    if (bead.cobalt && cobalts >= cobaltRoom) bead.cobalt = false;
    if (bead.cobalt) cobalts++;
  }
  stats.cobalt += cobalts;
  const [d0, d1] = BEAD_TRAIL.diameter;
  const [a0, a1] = BEAD_TRAIL.alpha;
  for (let g = ghosts; g >= 1; g--) {
    const t = ghosts <= 1 ? 0 : (g - 1) / (ghosts - 1);
    const radius = ((d0 + (d1 - d0) * t) * unit) / 2;
    const alpha = a0 + (a1 - a0) * t;
    for (let k = 0; k < count; k++) {
      const bead = beads[k]!;
      if (!bead.trail) continue;
      scene.ghostPose(bead.index, g * gap, ghost);
      // A ghost that has not left the head (a bead at the start of its rail) is not drawn.
      if (Math.hypot(ghost.x - bead.x, ghost.y - bead.y) < 1) continue;
      disc(ctx, palette, ghost.x, ghost.y, radius, alpha * Math.min(bead.alpha, ghost.alpha), bead.cobalt);
    }
  }
  const radius = tier.beadSize / 2;
  for (let k = 0; k < count; k++) {
    const bead = beads[k]!;
    disc(ctx, palette, bead.x, bead.y, radius, bead.alpha * 0.9, bead.cobalt);
  }
}

export function paintRobots(ctx: CanvasRenderingContext2D, scene: HeroScene, palette: Palette, share: number, still: boolean, stats: PaintStats): void {
  const tier = scene.tier;
  const onHands = share > 0;
  stats.robots = 0;
  stats.beads = 0;
  let beadCount = 0;
  for (let i = 0; i < scene.robots.length; i++) {
    const pose = scene.robots[i]!;
    if (pose.alpha <= 0.01) continue;
    stats.robots++;
    if (pose.bead && !still) {
      const bead = beads[beadCount++]!;
      bead.x = pose.x;
      bead.y = pose.y;
      bead.alpha = pose.alpha;
      bead.cobalt = pose.accent;
      // The index of the robot, to ask the scene for the ghosts of its rail; a messenger leaves a trail only on its way to the tip.
      bead.index = i;
      bead.trail = roleOf(i, tier).role === "circulant" || scene.live.t < LIVE_CYCLE.approach;
      continue;
    }
    const role = onHands ? roleOf(i, tier).role : "none";
    const target = role === "orbital" ? tier.orbitSize : tier.handsRobotSize;
    const size = onHands ? tier.robotSize + (target - tier.robotSize) * share : tier.robotSize;
    const port = onHands ? (role === "orbital" ? ORBIT_PORT : ROBOT_PORT) : 2;
    const depth = pose.z < -0.12 ? 0.55 : 1;
    ctx.globalAlpha = pose.alpha * depth;
    ctx.fillStyle = palette.ink;
    ctx.fillRect(pose.x - size / 2, pose.y - size / 2, size, size);
    ctx.fillStyle = pose.accent ? palette.accent : palette.canvas;
    ctx.fillRect(pose.x - port / 2, pose.y - port / 2, port, port);
    if (pose.accent) stats.cobalt++;
  }
  stats.beads = beadCount;
  if (beadCount > 0) paintBeads(ctx, scene, palette, beadCount, stats);
}

/**
 * The cobalt contact point between the two index fingers, its swell, then (living act) the bit that
 * crosses the gap and the ring that follows it: never together, so that at most two cobalt marks
 * (the point and one of the three) are on the canvas at once.
 */
export function paintContact(ctx: CanvasRenderingContext2D, scene: HeroScene, palette: Palette, opacity: number, still: boolean, stats: PaintStats): void {
  if (!scene.handsData || opacity <= 0) return;
  const live = scene.live;
  const tier = scene.tier;
  const moving = !still && live.moving;
  let size = tier.contactSize;
  if (moving && live.step === "contact") size *= 1 + (CONTACT_SWELL - 1) * Math.sin((Math.PI * (live.t - LIVE_CYCLE.approach)) / LIVE_CYCLE.contact);
  ctx.fillStyle = palette.accent;
  ctx.globalAlpha = opacity;
  ctx.fillRect(live.contactX - size / 2, live.contactY - size / 2, size, size);
  stats.cobalt++;
  if (!moving) return;
  const ringAt = (live.t - RING.start) / RING.duration;
  if (ringAt >= 0 && ringAt <= 1) {
    ctx.globalAlpha = 0.7 * (1 - ringAt);
    ctx.strokeStyle = palette.accent;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(live.contactX, live.contactY, (RING.from + (RING.to - RING.from) * easeInOutSine(ringAt)) * tier.motionScale, 0, Math.PI * 2);
    ctx.stroke();
    stats.cobalt++;
  }
  const bitAt = (live.t - MESSENGER.bitStart) / MESSENGER.bitDuration;
  if (bitAt >= 0 && bitAt <= 1) {
    const e = easeInOutSine(bitAt);
    ctx.globalAlpha = 1;
    ctx.fillRect(live.tip.lx + (live.tip.rx - live.tip.lx) * e - 2, live.tip.ly + (live.tip.ry - live.tip.ly) * e - 2, 4, 4);
    stats.cobalt++;
  }
}
