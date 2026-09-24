import type { CSSProperties } from "react";

import styles from "./HeroTitle.module.css";

type HeroTitleProps = {
  /** One entry per visual line (desktop). */
  lines: readonly string[];
  /** Lines from this index on are set in the secondary ink. */
  secondFrom?: number;
  id?: string;
};

/**
 * Editorial `h1` of the landing. The final text is in the HTML, fully readable
 * without JavaScript: the reveal (line by line, then word by word, under a
 * mask, with a short blur) is pure CSS, and skipped under reduced motion.
 * The accessible name is the sentence, read once from a visually hidden copy;
 * the animated words are `aria-hidden`.
 */
export function HeroTitle({ lines, secondFrom = lines.length, id }: HeroTitleProps) {
  let wordIndex = 0;
  return (
    <h1 id={id} className={styles.title}>
      {/* The sentence as one text node: accessible names do not always keep
          the spaces between animated inline-block words. */}
      <span className="sr-only">{lines.join(" ")}</span>
      <span aria-hidden="true" data-testid="hero-title-visual">
        {lines.map((line, lineIndex) => (
          <span key={line} className={lineIndex >= secondFrom ? `${styles.line} ${styles.muted}` : styles.line}>
            {line.split(" ").map((word, index, words) => {
              const style = { "--line": lineIndex, "--word": wordIndex++ } as CSSProperties;
              return (
                <span key={`${word}-${index}`}>
                  <span className={styles.word} style={style}>
                    {word}
                  </span>
                  {index < words.length - 1 ? " " : null}
                </span>
              );
            })}{" "}
          </span>
        ))}
      </span>
    </h1>
  );
}
