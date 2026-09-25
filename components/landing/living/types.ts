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
  /** Organic variation of the node size (0..1), used only when presence > 1. */
  variance: number;
};
export type LinkDraw = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  alpha: number;
  dashed: boolean;
  trail: boolean;
  /** A main connection, drawn a little more present when presence > 1. */
  strong: boolean;
};
export type TokenDraw = { x: number; y: number; tx: number; ty: number; alpha: number; still: boolean };
export type MarkDraw = { x: number; y: number; kind: "halt" | "check"; angle: number; alpha: number };
export type MoteDraw = { x: number; y: number; r: number; alpha: number };
export type FragmentDraw = { x: number; y: number; text: string; alpha: number };
/** A vertex of the mesh: the resting place of an ambient prospect. */
export type MeshPointDraw = {
  x: number;
  y: number;
  /** Opacity of the vertex dot (0 when the prospect itself is drawn there). */
  alpha: number;
  /** Far plane: paler, smaller, less parallax. */
  far: boolean;
  /**
   * Scenes with a mesh profile (agents): every vertex drawn, with this radius
   * and opacity (before intensity); a hub is an outlined circle.
   */
  look?: { r: number; alpha: number; hub: boolean };
};
/**
 * A resting connection of the mesh: always grey, never the accent colour.
 * `parts` (shares of the segment, 0..1) lists the pieces actually drawn when a
 * label interrupts the line; absent, the whole segment is drawn.
 */
export type MeshLinkDraw = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  alpha: number;
  far: boolean;
  parts?: readonly (readonly [number, number])[];
  /**
   * Scenes with a mesh profile (agents): line width, CSS px. `alpha` is then
   * the final opacity before intensity (the reference cap does not apply).
   */
  width?: number;
};
/** A small cobalt impulse travelling along a mesh link (tail → head). */
export type PulseDraw = {
  x: number;
  y: number;
  tx: number;
  ty: number;
  alpha: number;
  /**
   * Scenes with a mesh profile (agents): the impulse travels a route of links.
   * `trail` lists the tail points from the head backwards (x, y pairs), drawn
   * in segments of decreasing opacity; `r` is the dot radius; `flash` the
   * vertex it just reached, briefly cobalt (no halo).
   */
  trail?: readonly number[];
  r?: number;
  trailWidth?: number;
  flash?: { x: number; y: number; r: number; alpha: number };
};

export type Frame = {
  nodes: NodeDraw[];
  links: LinkDraw[];
  tokens: TokenDraw[];
  marks: MarkDraw[];
  motes: MoteDraw[];
  fragments: FragmentDraw[];
  /** Mesh of the problem and agents scenes (empty everywhere else). */
  meshPoints: MeshPointDraw[];
  meshLinks: MeshLinkDraw[];
  pulses: PulseDraw[];
  /** Visual presence, blended between scenes (1 = reference rendering). */
  presence: number;
  /** Mesh weight, blended between scenes (0 = no mesh, reference rendering). */
  mesh: number;
  /** Largest vertical parallax shift applied to the mesh in this frame, CSS px. */
  parallax: number;
};
