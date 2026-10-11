/**
 * FLIP (First, Last, Invert, Play) for the « open the app » transition: the
 * tile of the selected step grows into the header of the panel. Pure: the
 * transform that puts the LAST box back on the FIRST one, with a top-left
 * transform origin.
 */

export type Box = { left: number; top: number; width: number; height: number };

export type FlipTransform = { x: number; y: number; scaleX: number; scaleY: number };

export function flipTransform(first: Box, last: Box): FlipTransform | null {
  if (last.width <= 0 || last.height <= 0 || first.width <= 0 || first.height <= 0) return null;
  return {
    x: first.left - last.left,
    y: first.top - last.top,
    scaleX: first.width / last.width,
    scaleY: first.height / last.height,
  };
}

export function flipKeyframe({ x, y, scaleX, scaleY }: FlipTransform): string {
  return `translate(${x}px, ${y}px) scale(${scaleX}, ${scaleY})`;
}
