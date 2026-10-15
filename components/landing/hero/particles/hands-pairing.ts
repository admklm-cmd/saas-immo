import type { Hands } from "./hands-data";
import { pairShapes, rankShare } from "./pairing";
import { emptyShape, type Shape } from "./shapes";

/**
 * Pairing of the identities of the opening with the hands (docs/design-system.md T.2, U.5(c)). The identities of the
 * left half of the sphere become the left hand, those of the right half the right hand; inside each half the
 * pairing follows the Hilbert curve (C.1), so the flow looks organised. The wave rank of a point is the rank of its
 * x on the sphere: the left hand is drawn first, the right one from about 5 s. Computed once, outside the frame loop.
 */
export type HandsPairing = {
  /** The hands, reordered so that point i is the final place of identity i. */
  readonly handsShape: Shape;
  /** Wave rank (0..1) of the identities then of the skin points (the skin leaves in place, it has no hand to go to). */
  readonly rank: Float32Array;
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

/** `sphere`: positions of all the points (identities, then skin) at the pairing time, in sphere units. */
export function pairHands(hands: Hands, count: number, skin: number, sphere: Points): HandsPairing {
  const target = hands.shape;
  const left: number[] = [];
  const right: number[] = [];
  for (let j = 0; j < count; j++) (target.x[j]! < 0 ? left : right).push(j);
  const ids = Array.from({ length: count }, (_, i) => i).sort((a, b) => sphere.x[a]! - sphere.x[b]! || a - b);
  const handsShape = emptyShape(count);
  const place = (list: number[], targets: number[]) => {
    const out = pairShapes(subset(sphere, list), subset(target, targets));
    list.forEach((identity, k) => {
      handsShape.x[identity] = out.x[k]!;
      handsShape.y[identity] = out.y[k]!;
      handsShape.z[identity] = out.z[k]!;
    });
  };
  place(ids.slice(0, left.length), left);
  place(ids.slice(left.length), right);

  const rank = new Float32Array(count + skin);
  ids.forEach((identity, k) => (rank[identity] = count > 1 ? k / (count - 1) : 0));
  const skinRank = rankShare(Array.from({ length: skin }, (_, k) => sphere.x[count + k]!));
  for (let k = 0; k < skin; k++) rank[count + k] = skinRank[k]!;
  return { handsShape, rank };
}
