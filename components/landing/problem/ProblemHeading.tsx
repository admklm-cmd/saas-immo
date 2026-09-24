import { LANDING_TEXTS } from "@/components/landing-texts";

import styles from "./ProblemHeading.module.css";

const TEXTS = LANDING_TEXTS.problem;

/** Splits the answer around its emphasised word (kept whole if absent). */
function splitAnswer(answer: string, word: string): [string, string, string] {
  const index = answer.indexOf(word);
  if (index < 0) return [answer, "", ""];
  return [answer.slice(0, index), word, answer.slice(index + word.length)];
}

/**
 * Heading of the problem section, composed locally (the shared
 * `LandingHeading` is left untouched): the observation in the secondary ink,
 * the answer in full ink, the word « administratif » set apart by a fine rule
 * drawn under it. The accessible name is the full title.
 */
export function ProblemHeading() {
  const [lead, answer] = TEXTS.titleLines;
  const [before, word, after] = splitAnswer(answer, TEXTS.titleEmphasis);

  return (
    <div className={styles.heading}>
      <p className="text-overline font-semibold text-ink-subtle uppercase">{TEXTS.kicker}</p>
      <h2 id="problem-title" className={styles.title}>
        <span className={styles.lead}>{lead}</span>{" "}
        <span className={styles.answer}>
          {before}
          {word ? <span className={styles.emphasis}>{word}</span> : null}
          {after}
        </span>
      </h2>
      <p className={styles.body}>{TEXTS.body}</p>
    </div>
  );
}
