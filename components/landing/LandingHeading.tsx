import { EditorialTitle, type AccentEffect } from "@/components/ui/EditorialTitle";
import { Overline } from "@/components/ui/Overline";
import { cn } from "@/components/ui/cn";

type LandingHeadingProps = {
  id: string;
  kicker?: string;
  /** Author lines of the sentence title (docs/design-system.md §2.2.9). */
  titleLines: readonly string[];
  /** The one accented word of the title. */
  titleAccent: string;
  body?: string;
  /**
   * Local readability veil above the living background. Off inside an already
   * opaque panel (final call to action), where it would draw a lighter box.
   */
  veil?: boolean;
  /** Effect of the accented word (final panel only, docs/design-system.md §2.11.2). */
  accentEffect?: AccentEffect;
  className?: string;
};

/**
 * Heading of a landing section: mono overline with the cobalt dash, editorial
 * h2 revealed line by line when the enclosing `Reveal frame="still"` enters
 * the viewport, one paragraph. The title may take `max-w-5xl`, the paragraph
 * keeps a reading measure. Posed on a local veil so it stays AA above the
 * living background (except with `veil={false}`, inside an opaque panel).
 */
export function LandingHeading({
  id,
  kicker,
  titleLines,
  titleAccent,
  body,
  veil = true,
  accentEffect,
  className,
}: LandingHeadingProps) {
  return (
    <div className={cn(veil && "particle-veil", "max-w-5xl", className)}>
      {kicker ? <Overline>{kicker}</Overline> : null}
      <EditorialTitle
        as="h2"
        id={id}
        lines={titleLines}
        accent={titleAccent}
        size="statement"
        reveal="in-view"
        accentEffect={accentEffect}
        className={kicker ? "mt-5" : undefined}
      />
      {body ? <p className="mt-6 max-w-[52ch] text-lede text-pretty text-ink-muted">{body}</p> : null}
    </div>
  );
}
