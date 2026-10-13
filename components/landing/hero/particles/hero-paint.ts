import { SPHERE_OPACITY, CONTACT_SWELL, HANDS_EMPHASIS, HANDS_GROWTH, HANDS_POINT_MAX, LIVE_CYCLE, MESSENGER, ORBIT_PORT, PLANES, RING, ROBOT_PORT, ROBOT_TRAIL } from "./hero-config";
import { CLASS_COUNT, HeroScene } from "./HeroScene";
import { roleOf } from "./hands-robots";
import type { RobotPose } from "./robots";
import type { PhaseState } from "./timeline";
import { easeInOutSine } from "./trajectory";

/**
 * What the hero canvas draws, apart from the loop (docs/design-system.md §2.11.4 ter G, S.6): the
 * points by depth plane, the robots (with the trail of the circulants and the cobalt port of the
 * left messenger), the cobalt contact point, its ring and its bit. Every colour comes from the CSS
 * tokens of the canvas; nothing is red or orange and nothing glows.
 */
export type Palette = { readonly ink: string; readonly canvas: string; readonly accent: string };

/** What was drawn in the last image (published as test attributes). */
export type PaintStats = { robots: number; cobalt: number };

const ghost: RobotPose = { x: 0, y: 0, z: 0, alpha: 0, accent: false };

/** Share of the hands in the image: 0 before the last transition, its progress during it, 1 after (or on a still image). */
export function handsShareOf(state: PhaseState, still: boolean): number {
  return still ? 1 : state.phase === "hands" ? 1 : state.phase === "to-hands" ? state.progress : 0;
}

/**
 * Share of the « hands look » (stronger, larger points) of the image: 0 on the big sphere, rising while the hand
 * takes the ball (the ball keeps its emphasis), 1 from the held ball on. Points only; the robots use `handsShareOf`.
 */
export function lookShareOf(state: PhaseState, still: boolean): number {
  if (still || state.phase === "hands" || state.phase === "hand" || state.phase === "to-hands") return 1;
  return state.phase === "to-hand" ? state.progress : 0;
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
    const size = Math.min(plane.size * grow, HANDS_POINT_MAX);
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

export function paintRobots(ctx: CanvasRenderingContext2D, scene: HeroScene, palette: Palette, state: PhaseState, share: number, still: boolean, stats: PaintStats): void {
  const tier = scene.tier;
  const onHands = share > 0;
  const live = state.phase === "hands" && !still;
  stats.robots = 0;
  for (let i = 0; i < scene.robots.length; i++) {
    const pose = scene.robots[i]!;
    if (pose.alpha <= 0.01) continue;
    stats.robots++;
    const role = onHands ? roleOf(i, tier).role : "none";
    const target = role === "orbital" ? tier.orbitSize : tier.handsRobotSize;
    const size = onHands ? tier.robotSize + (target - tier.robotSize) * share : tier.robotSize;
    const port = onHands ? (role === "orbital" ? ORBIT_PORT : ROBOT_PORT) : 2;
    const depth = pose.z < -0.12 ? 0.55 : 1;
    // A trail behind the robots that travel the rails (and the messengers on their way to the tips).
    const travelling = role === "circulant" || (role === "messenger" && scene.live.t < LIVE_CYCLE.approach);
    if (live && travelling) {
      const half = Math.max(2, Math.round(size * 0.28));
      ctx.fillStyle = palette.ink;
      for (const { gap, alpha } of ROBOT_TRAIL) {
        scene.ghostPose(i, gap, ghost);
        ctx.globalAlpha = alpha * ghost.alpha;
        ctx.fillRect(ghost.x - half, ghost.y - half, half * 2, half * 2);
      }
    }
    ctx.globalAlpha = pose.alpha * depth;
    ctx.fillStyle = palette.ink;
    ctx.fillRect(pose.x - size / 2, pose.y - size / 2, size, size);
    ctx.fillStyle = pose.accent ? palette.accent : palette.canvas;
    ctx.fillRect(pose.x - port / 2, pose.y - port / 2, port, port);
    if (pose.accent) stats.cobalt++;
  }
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
