import type { Hands } from "./hands-data";
import { pairShapes, rankShare } from "./pairing";
import { buildBall, emptyShape, type Shape } from "./shapes";

/**
 * Pairing of the identities of the opening with the hands and the ball (docs/design-system.md T.2). The
 * identities of the left half of the sphere become the left hand; those of the right half become the ball,
 * then the right hand; the skin goes to the ball too. Inside each half the pairing follows the Hilbert curve
 * (C.1), so the flow looks organised. Computed once, outside the frame loop.
 */
export type HoldPairing = {
  /** The hands, reordered so that point i is the final place of identity i. */
  readonly handsShape: Shape;
  /** 1 for the identities that become the left hand, 0 for those that become the ball then the right hand. */
  readonly isLeft: Uint8Array;
  /** Place of each right-half identity on the unit ball (radius 1). */
  readonly ball: Shape;
  /** Place of each skin point on the unit ball. */
  readonly skinBall: Shape;
  /** Wave ranks (0..1) of the first transition (identities then skin) and of the last (identities). */
  readonly rankHand: Float32Array;
  readonly rankHands: Float32Array;
};

type Points = { x: ArrayLike<number>; y: ArrayLike<number>; z: ArrayLike<number> };

function subset(source: Points, list: readonly number[]): Shape {
  const shape = emptyShape(list.length);
  list.forEach((index, k) => {
    shape.x[k] = source.x[index]!;
    shape.y[k] = source.y[index]!;
    shape.z[k] = source.z[index]!;
  });
  return shape;
}

/** `sphere`: positions of all the points (identities, then skin) at the end of the sphere phase, in sphere units. */
export function pairHold(hands: Hands, count: number, skin: number, sphere: Points): HoldPairing {
  const target = hands.shape;
  const left: number[] = [];
  const right: number[] = [];
  for (let j = 0; j < count; j++) (target.x[j]! < 0 ? left : right).push(j);
  const ids = Array.from({ length: count }, (_, i) => i).sort((a, b) => sphere.x[a]! - sphere.x[b]! || a - b);
  const leftIds = ids.slice(0, left.length);
  const rightIds = ids.slice(left.length);

  const handsShape = emptyShape(count);
  const isLeft = new Uint8Array(count);
  const place = (list: number[], targets: number[], flag: number) => {
    const out = pairShapes(subset(sphere, list), subset(target, targets));
    list.forEach((identity, k) => {
      handsShape.x[identity] = out.x[k]!;
      handsShape.y[identity] = out.y[k]!;
      handsShape.z[identity] = out.z[k]!;
      isLeft[identity] = flag;
    });
    return out;
  };
  place(leftIds, left, 1);
  const rightHands = place(rightIds, right, 0);

  // The ball: right-half identities, paired with their place in the right hand; the skin goes to the ball too.
  const ball = emptyShape(count);
  const ballOfRight = pairShapes(rightHands, buildBall(rightIds.length));
  rightIds.forEach((identity, k) => {
    ball.x[identity] = ballOfRight.x[k]!;
    ball.y[identity] = ballOfRight.y[k]!;
    ball.z[identity] = ballOfRight.z[k]!;
  });
  const skinIds = Array.from({ length: skin }, (_, k) => count + k);
  const skinBall = pairShapes(subset(sphere, skinIds), buildBall(skin, 1));

  // Ranks of the waves: the fingers of the left hand last; the ball by angle; the right hand by distance to the contact, inverted.
  const nearTip = (list: readonly number[], tip: readonly [number, number]) => rankShare(list.map((i) => Math.hypot(handsShape.x[i]! - tip[0], handsShape.y[i]! - tip[1])));
  const rankHand = new Float32Array(count + skin);
  const leftRank = nearTip(leftIds, hands.tips.left);
  leftIds.forEach((identity, k) => (rankHand[identity] = 1 - leftRank[k]!));
  const angle = rankShare(rightIds.map((i) => Math.atan2(ball.y[i]!, ball.x[i]!)));
  rightIds.forEach((identity, k) => (rankHand[identity] = angle[k]!));
  const skinAngle = rankShare(Array.from({ length: skin }, (_, k) => Math.atan2(skinBall.y[k]!, skinBall.x[k]!)));
  for (let k = 0; k < skin; k++) rankHand[count + k] = skinAngle[k]!;
  const rankHands = new Float32Array(count);
  const rightRank = nearTip(rightIds, [0, 0]);
  rightIds.forEach((identity, k) => (rankHands[identity] = 1 - rightRank[k]!));

  return { handsShape, isLeft, ball, skinBall, rankHand, rankHands };
}
