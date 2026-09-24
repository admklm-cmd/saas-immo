import type { ComponentType } from "react";

import { GLYPH_STROKE_WIDTH, GLYPH_VIEWBOX, GLYPHS, type GlyphName } from "./glyphs";

export type GlyphProps = {
  name: GlyphName;
  className?: string;
  /** Rendered size in px (the grid is 24). Defaults to 16. */
  width?: number | string;
  height?: number | string;
};

/**
 * One symbol of the Ascend glyph family (`glyphs.ts`). Always decorative
 * (`aria-hidden`): the words next to it carry the meaning.
 *
 * The accent layer is a separate group (`data-glyph-accent`) so a container
 * (`AgentAppIcon`) can move it on hover or activation; `pathLength="1"` lets a
 * `draw` glyph be traced with one dash, whatever its real length.
 */
export function Glyph({ name, className, width = 16, height = width }: GlyphProps) {
  const glyph = GLYPHS[name];
  const draw = glyph.motion === "draw";

  return (
    <svg
      viewBox={GLYPH_VIEWBOX}
      width={width}
      height={height}
      fill="none"
      stroke="currentColor"
      strokeWidth={GLYPH_STROKE_WIDTH}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
      data-glyph={name}
      data-motion={glyph.motion}
    >
      {glyph.paths.map((d) => (
        <path key={d} d={d} />
      ))}
      <g data-glyph-accent="">
        {glyph.accent.map((d) => (
          <path key={d} d={d} pathLength={draw ? 1 : undefined} />
        ))}
      </g>
    </svg>
  );
}

type GlyphIconProps = { className?: string; width?: number | string; height?: number | string };

/**
 * A glyph as an icon component, for the maps that expect one
 * (`AGENT_ICONS`, `JOURNEY_ICONS`, the rail nodes).
 */
export function glyphIcon(name: GlyphName): ComponentType<GlyphIconProps> {
  function GlyphIcon(props: GlyphIconProps) {
    return <Glyph name={name} {...props} />;
  }
  GlyphIcon.displayName = `Glyph(${name})`;
  return GlyphIcon;
}
