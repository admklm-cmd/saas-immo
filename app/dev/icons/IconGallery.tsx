import { AgentAppIcon, type AppIconKind, type AppIconSize, type AppIconState } from "@/features/agents-ia/components/icons/AgentAppIcon";
import { Glyph } from "@/features/agents-ia/components/icons/Glyph";
import { GLYPH_NAMES, STAGE_GLYPHS, type GlyphName } from "@/features/agents-ia/components/icons/glyphs";

import { ICON_GALLERY_TEXTS as T } from "./gallery-texts";

const GLYPH_SIZES = [14, 16, 24] as const;
const TILE_SIZES: readonly AppIconSize[] = ["sm", "md", "lg", "xl"];
const STATES: readonly AppIconState[] = ["idle", "active", "inactive"];

/** Kind of tile drawn for each stage glyph (the same mapping as the rail). */
const STAGE_KINDS: Readonly<Record<(typeof STAGE_GLYPHS)[number], AppIconKind>> = {
  lea: "agent",
  hugo: "agent",
  emma: "agent",
  louis: "agent",
  sarah: "agent",
  human: "human",
  mandate: "outcome",
  prospect: "neutral",
  appointment: "neutral",
};

function GlyphCell({ name }: { name: GlyphName }) {
  return (
    <li className="flex flex-col items-center gap-3 rounded-lg bg-surface-muted px-3 py-4" data-testid="icon-gallery-glyph">
      <div className="flex items-end gap-4 text-ink">
        {GLYPH_SIZES.map((size) => (
          <Glyph key={size} name={name} width={size} />
        ))}
      </div>
      <span className="font-mono text-xs text-ink-muted">{name}</span>
    </li>
  );
}

/**
 * Server Component: every glyph at 14 / 16 / 24 px, then every stage in its
 * tile, at each size and in each state, on the light and on the dark surface.
 * Hover a tile button to see the motion of its symbol.
 */
export function IconGallery() {
  return (
    <main className="mx-auto min-h-dvh max-w-6xl px-6 py-12 sm:px-10 lg:py-16">
      <header className="max-w-3xl">
        <p className="text-overline font-semibold text-ink-subtle uppercase">{T.overline}</p>
        <h1 className="mt-3 text-title font-semibold text-balance">{T.title}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-muted">{T.intro}</p>
      </header>

      <section className="mt-10" aria-labelledby="glyphs-title">
        <h2 id="glyphs-title" className="text-heading font-semibold">
          {T.glyphs}
        </h2>
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {GLYPH_NAMES.map((name) => (
            <GlyphCell key={name} name={name} />
          ))}
        </ul>
      </section>

      {(["light", "dark"] as const).map((surface) => (
        <section
          key={surface}
          aria-labelledby={`tiles-${surface}`}
          className={surface === "dark" ? "mt-10 rounded-2xl bg-inverse p-6 text-ink-inverse" : "mt-10"}
        >
          <h2 id={`tiles-${surface}`} className="text-heading font-semibold">
            {surface === "dark" ? T.tilesDark : T.tilesLight}
          </h2>
          <div className="mt-4 grid gap-6">
            {STATES.map((state) => (
              <div key={state}>
                <p className="text-overline font-semibold uppercase opacity-70">{T.states[state]}</p>
                <ul className="mt-3 flex flex-wrap items-end gap-5">
                  {STAGE_GLYPHS.map((glyph) => (
                    <li key={glyph}>
                      <button type="button" className="ui-focus flex items-end gap-3 rounded-lg p-2" aria-label={glyph}>
                        {TILE_SIZES.map((size) => (
                          <AgentAppIcon
                            key={size}
                            glyph={glyph}
                            kind={STAGE_KINDS[glyph]}
                            size={size}
                            state={state}
                            surface={surface}
                          />
                        ))}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}
