import { Fragment, type CSSProperties, type ReactNode } from "react";

import { cn } from "./cn";
import { accentOverhangEm, findAccent, isAnimatable, splitAccent, tokensOf } from "./editorial-title";
import styles from "./EditorialTitle.module.css";
import replayStyles from "./EditorialTitleReplay.module.css";

export type EditorialTitleProps = {
  /** One `h1` per page. */
  as: "h1" | "h2";
  /** Target of the `aria-labelledby` of the section. */
  id: string;
  /** Author lines, declared in the texts (never measured at runtime). */
  lines: readonly string[];
  /** A whole word present exactly once in `lines`; otherwise no accent. */
  accent?: string;
  /** Lines of index < n are set in the subtle ink (problem section: 2). */
  subtleBefore?: number;
  /** `poster` must sit in a `container-type: inline-size` column. */
  size: "poster" | "statement" | "page";
  /**
   * `load`: CSS animation on load (100 ms delay); `in-view`: plays under the
   * enclosing `Reveal` (`[data-reveal="entering"]`); `none`: static.
   */
  reveal: "load" | "in-view" | "none";
  /**
   * Effect of the accented word, landing only (docs/design-system.md §2.11.2):
   * `underline` (hero), `focus` (problem), `focus-underline` (the other
   * landing section titles and the final panel).
   * Default `none`: the CRM and /estimation keep their rendering.
   */
  accentEffect?: AccentEffect;
  /**
   * Replays the effect when a mouse or a pen enters the title (landing only,
   * §2.11.2 D): sets `data-accent-replayable` when the effect is not `none`.
   * The page mounts one `AccentReplayController`; this component stays a
   * Server Component. Default `false`.
   */
  accentReplay?: boolean;
  /** Layout only (margins, max width). */
  className?: string;
};

export type AccentEffect = "none" | "underline" | "focus" | "focus-underline";

const EFFECT_CLASS = {
  none: undefined,
  underline: styles.effectUnderline,
  focus: styles.effectFocus,
  "focus-underline": styles.effectFocusUnderline,
} as const;

/** A comma or semicolon right after the accent dips under the baseline: the mark stops at the word (§2.11.2). */
const DESCENDING_PUNCTUATION = /^[,;]/;

const SIZE_CLASS = {
  poster: styles.poster,
  statement: "text-statement",
  page: "text-title sm:text-hero lg:text-page",
} as const;

const REVEAL_CLASS = {
  load: styles.load,
  "in-view": styles.inView,
  none: undefined,
} as const;

/**
 * Sentence title of the public site (docs/design-system.md §2.2.7, §3.8):
 * author lines, one accented word in Instrument Serif italic, and a line by
 * line reveal in pure CSS — the accented word appears first, sharp; the other
 * words pass from blurred to sharp, line after line. The final state is the
 * default (readable without JavaScript and under reduced motion). The
 * landing may add one effect on the accented word (`accentEffect`, §2.11.2),
 * played once, in CSS, ending on that same final state. The accessible name is the sentence, read once from a visually
 * hidden copy; the visual lines are `aria-hidden`.
 */
export function EditorialTitle({
  as: Tag,
  id,
  lines,
  accent,
  subtleBefore = 0,
  size,
  reveal,
  accentEffect = "none",
  accentReplay = false,
  className,
}: EditorialTitleProps) {
  const mode = isAnimatable(lines) ? reveal : "none";
  const animated = mode !== "none";
  const target = findAccent(lines, accent);
  const effect: AccentEffect = target ? accentEffect : "none";
  const hasMark = effect === "underline" || effect === "focus-underline";
  const hasFrame = effect === "focus" || effect === "focus-underline";
  const replayable = accentReplay && effect !== "none";

  function word(text: string, line: number, key?: string): ReactNode {
    return (
      <span
        key={key}
        className={cn(styles.word, animated && styles.focusWord, replayable && replayStyles.word)}
        style={animated ? ({ "--line": line } as CSSProperties) : undefined}
      >
        {text}
      </span>
    );
  }

  function renderToken(token: string, line: number, index: number): ReactNode {
    const parts = target && target.line === line && target.token === index ? splitAccent(token, accent ?? "") : null;
    if (!parts) return word(token, line);
    const [before, accented, after] = parts;
    return (
      <span className={styles.nowrap}>
        {before ? word(before, line, "before") : null}
        <span
          className={cn(
            "title-accent",
            animated && styles.sharpWord,
            effect !== "none" && styles.accentHost,
            replayable && replayStyles.sharp,
          )}
          data-accent=""
          style={hasFrame ? ({ "--accent-overhang": `${accentOverhangEm(accented)}em` } as CSSProperties) : undefined}
        >
          {accented}
          {/* Empty ornaments: they add no text and never change the line box. */}
          {hasFrame ? <span className={cn(styles.frame, replayable && replayStyles.frame)} data-accent-frame="" /> : null}
          {hasMark ? (
            <span
              className={cn(styles.mark, DESCENDING_PUNCTUATION.test(after) && styles.markBeforeDescender, replayable && replayStyles.mark)}
              data-accent-mark=""
            />
          ) : null}
        </span>
        {after ? word(after, line, "after") : null}
      </span>
    );
  }

  return (
    <Tag
      id={id}
      className={cn(
        "font-display font-semibold text-ink",
        styles.title,
        SIZE_CLASS[size],
        REVEAL_CLASS[mode],
        EFFECT_CLASS[effect],
        className,
      )}
      data-title-reveal={mode}
      data-accent-effect={effect === "none" ? undefined : effect}
      data-accent-replayable={replayable ? "" : undefined}
    >
      <span className="sr-only">{lines.join(" ")}</span>
      <span aria-hidden="true" data-testid="editorial-title-visual">
        {lines.map((line, lineIndex) => {
          const tokens = tokensOf(line);
          return (
            <Fragment key={`${lineIndex}-${line}`}>
              <span
                className={cn(styles.line, lineIndex < subtleBefore && styles.subtle)}
                data-title-line={lineIndex}
                data-title-tone={lineIndex < subtleBefore ? "subtle" : undefined}
              >
                {tokens.map((token, index) => (
                  <span key={`${index}-${token}`}>
                    {renderToken(token, lineIndex, index)}
                    {index < tokens.length - 1 ? " " : null}
                  </span>
                ))}
              </span>
              {/* Collapsed between two blocks; keeps the copied text a sentence. */}
              {lineIndex < lines.length - 1 ? " " : null}
            </Fragment>
          );
        })}
      </span>
    </Tag>
  );
}
