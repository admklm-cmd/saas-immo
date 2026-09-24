/** Shapes shared by the living background model, its parts and its renderer. */

import type { LivingScene } from "./scenes";

export type Viewport = { width: number; height: number; compact: boolean };

export type SceneState = {
  scene: LivingScene;
  /** Clock time at which `scene` became current. */
  since: number;
  previous: LivingScene | null;
  /** Pixel positions of the stops displayed when the scene changed (x, y pairs). */
  from: readonly number[] | null;
};

export type NodeDraw = {
  x: number;
  y: number;
  stop: number;
  /** Vertical lane offset, CSS px (several clean paths in the result scene). */
  dy: number;
  alpha: number;
  activity: number;
  label: string | null;
};
export type LinkDraw = { x1: number; y1: number; x2: number; y2: number; alpha: number; dashed: boolean; trail: boolean };
export type TokenDraw = { x: number; y: number; tx: number; ty: number; alpha: number; still: boolean };
export type MarkDraw = { x: number; y: number; kind: "halt" | "check"; angle: number; alpha: number };
export type MoteDraw = { x: number; y: number; r: number; alpha: number };
export type FragmentDraw = { x: number; y: number; text: string; alpha: number };

export type Frame = {
  nodes: NodeDraw[];
  links: LinkDraw[];
  tokens: TokenDraw[];
  marks: MarkDraw[];
  motes: MoteDraw[];
  fragments: FragmentDraw[];
};
