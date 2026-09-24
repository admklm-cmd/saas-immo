import { LANDING_TEXTS } from "@/components/landing-texts";
import { Reveal } from "@/components/ui/Reveal";
import { PIPELINE_STAGE_LABELS } from "@/features/contacts/types";
import { PIPELINE_STAGES } from "@/features/pipeline/types";

import { LandingHeading } from "./LandingHeading";

const TEXTS = LANDING_TEXTS.result;
/** The real stage names of the pipeline, `perdu` stated apart. */
const STAGES = PIPELINE_STAGES.filter((stage) => stage !== "perdu");

/** Section « Le résultat »: what the agency space shows for each file. */
export function LandingResult() {
  return (
    <section
      aria-labelledby="result-title"
      data-living-scene="resultat"
      className="mx-auto w-full max-w-7xl px-6 py-24 sm:px-8 lg:px-12 lg:py-36"
    >
      <Reveal>
        <LandingHeading id="result-title" kicker={TEXTS.kicker} title={TEXTS.title} body={TEXTS.body} />
      </Reveal>

      <div className="mt-14 rounded-xl border border-line bg-surface/90 p-6 shadow-subtle backdrop-blur-sm sm:p-8">
        <p className="text-overline font-semibold text-ink-subtle uppercase">{TEXTS.pipelineLabel}</p>
        <ol aria-label={TEXTS.pipelineLabel} className="mt-4 flex flex-wrap items-center gap-2">
          {STAGES.map((stage) => (
            <li
              key={stage}
              className="rounded-full border border-line-strong px-3 py-1 text-sm font-medium text-ink last:border-ink last:bg-ink last:text-ink-inverse"
            >
              {PIPELINE_STAGE_LABELS[stage]}
            </li>
          ))}
        </ol>
        <p className="mt-3 text-xs text-ink-muted">
          <span className="font-medium text-ink">{PIPELINE_STAGE_LABELS.perdu}</span> : {TEXTS.pipelineLostNote}
        </p>

        <ul className="mt-8 grid gap-6 border-t border-line pt-6 md:grid-cols-3">
          {TEXTS.outcomes.map((outcome) => (
            <li key={outcome.title}>
              <p className="text-sm font-semibold text-ink">{outcome.title}</p>
              <p className="mt-1 text-sm leading-relaxed text-ink-muted">{outcome.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
