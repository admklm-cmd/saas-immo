import { Icon } from "@/components/icons/Icon";
import { AGENT_ICON_NAMES, BOARD_ICON_NAMES, UTILITY_ICON_NAMES, type IconName } from "@/components/icons/icons";
import { AgentAppIcon, type AppIconKind, type AppIconState } from "@/features/agents-ia/components/icons/AgentAppIcon";

import { ICON_GALLERY_TEXTS as T } from "./gallery-texts";

const STATES: readonly AppIconState[] = ["idle", "active", "inactive"];

/** Kind of tile drawn for each stage (the same mapping as the rail). */
const STAGE_KINDS: Readonly<Record<(typeof AGENT_ICON_NAMES)[number], AppIconKind>> = {
  lea: "agent",
  hugo: "agent",
  emma: "agent",
  louis: "agent",
  sarah: "agent",
  prospect: "neutral",
  appointment: "neutral",
  mandate: "outcome",
};

function label(name: IconName): string {
  return (T.labels as Partial<Record<IconName, string>>)[name] ?? name;
}

const LABEL = "text-overline font-medium tracking-[0.14em] text-ink-muted uppercase";
const GRID = "grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6";

/** A small icon in a focusable cell: hover or Tab plays its story once. */
function SmallCell({ name }: { name: IconName }) {
  return (
    <li>
      <button
        type="button"
        className="ui-focus flex w-full flex-col items-center gap-3 rounded-lg px-2 py-5 text-ink transition-colors duration-150 ease-standard hover:bg-surface-muted"
        data-testid="icon-gallery-sm"
        data-name={name}
      >
        <span className="flex items-end gap-4">
          <Icon name={name} px={32} />
          <Icon name={name} px={16} />
        </span>
        <span className={LABEL}>{label(name)}</span>
      </button>
    </li>
  );
}

function LargeCell({ name }: { name: IconName }) {
  return (
    <li className="flex flex-col items-center gap-3 py-3" data-testid="icon-gallery-lg" data-name={name}>
      <Icon name={name} size="lg" px={88} />
      <span className={LABEL}>{label(name)}</span>
    </li>
  );
}

/**
 * Server Component: the 24 icons of the boards in both variants, the agents
 * and stages, the utility signs, then the step tiles in each state on the
 * light and on the dark surface. Compare with docs/references/icons/.
 */
export function IconGallery() {
  return (
    <main className="mx-auto min-h-dvh max-w-6xl px-6 py-12 sm:px-10 lg:py-16">
      <header className="max-w-3xl">
        <p className="text-overline font-semibold text-ink-subtle uppercase">{T.overline}</p>
        <h1 className="mt-3 text-title font-semibold text-balance">{T.title}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-muted">{T.intro}</p>
      </header>

      <section className="mt-10 rounded-2xl bg-surface p-6 shadow-subtle ring-1 ring-line" aria-labelledby="board-sm">
        <h2 id="board-sm" className="text-heading font-semibold">
          {T.boardSmall}
        </h2>
        <ul className={`mt-4 ${GRID}`} data-testid="gallery-board-sm">
          {BOARD_ICON_NAMES.map((name) => (
            <SmallCell key={name} name={name} />
          ))}
        </ul>
      </section>

      <section className="mt-10 rounded-2xl bg-pearl-soft p-6 ring-1 ring-line" aria-labelledby="board-lg">
        <h2 id="board-lg" className="text-heading font-semibold">
          {T.boardLarge}
        </h2>
        <ul className={`mt-6 ${GRID} gap-y-6`} data-testid="gallery-board-lg">
          {BOARD_ICON_NAMES.map((name) => (
            <LargeCell key={name} name={name} />
          ))}
        </ul>
      </section>

      <section className="mt-10" aria-labelledby="agents">
        <h2 id="agents" className="text-heading font-semibold">
          {T.agents}
        </h2>
        <ul className={`mt-4 ${GRID}`}>
          {AGENT_ICON_NAMES.map((name) => (
            <SmallCell key={name} name={name} />
          ))}
        </ul>
        <ul className={`mt-4 ${GRID} gap-y-6`}>
          {AGENT_ICON_NAMES.slice(0, 5).map((name) => (
            <LargeCell key={name} name={name} />
          ))}
        </ul>
      </section>

      <section className="mt-10" aria-labelledby="utility">
        <h2 id="utility" className="text-heading font-semibold">
          {T.utility}
        </h2>
        <ul className={`mt-4 ${GRID}`}>
          {UTILITY_ICON_NAMES.map((name) => (
            <SmallCell key={name} name={name} />
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
                  {AGENT_ICON_NAMES.map((glyph) => (
                    <li key={glyph}>
                      <button
                        type="button"
                        className="ui-focus flex items-end gap-3 rounded-lg p-2"
                        aria-label={label(glyph)}
                      >
                        {(["sm", "md", "xl"] as const).map((size) => (
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
