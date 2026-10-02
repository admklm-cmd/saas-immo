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
   * Readability veils above the network background, one per role of text
   * (docs/design-system.md §2.11.4): the overline and the paragraph on
   * `.particle-veil` (90 %), the title on `.network-veil-title` (70 %); each
   * block is a quiet zone of the network. Off inside an already opaque panel
   * (final call to action), where a veil would draw a lighter box.
   */
  veil?: boolean;
  /** Effect of the accented word (landing section titles, docs/design-system.md §2.11.2). */
  accentEffect?: AccentEffect;
  /** Replays the effect when a mouse or a pen enters the title (§2.11.2 D). */
  accentReplay?: boolean;
  className?: string;
};

/**
 * Heading of a landing section: mono overline with the cobalt dash, editorial
 * h2 revealed line by line when the enclosing `Reveal frame="still"` enters
 * the viewport, one paragraph. The title may take `max-w-5xl`, the paragraph
 * keeps a reading measure. Each text sits on its own veil, sized to its words,
 * so it stays AA above the network background while the network stays visible
 * between and, dimmed, behind them (except with `veil={false}`, inside an
 * opaque panel).
 */
export function LandingHeading({
  id,
  kicker,
  titleLines,
  titleAccent,
  body,
  veil = true,
  accentEffect,
  accentReplay = false,
  className,
}: LandingHeadingProps) {
  // Inside an opaque panel the network is already hidden: no quiet zone.
  const quiet = veil ? "" : undefined;
  return (
    <div className={cn("max-w-5xl", className)}>
      {kicker ? (
        <div className={cn(veil && "particle-veil particle-veil-tight", "w-fit")} data-network-quiet={quiet}>
          <Overline>{kicker}</Overline>
        </div>
      ) : null}
      <div className={cn(veil && "network-veil-title", "w-fit max-w-full", kicker && "mt-5")} data-network-quiet={quiet}>
        <EditorialTitle
          as="h2"
          id={id}
          lines={titleLines}
          accent={titleAccent}
          size="statement"
          reveal="in-view"
          accentEffect={accentEffect}
          accentReplay={accentReplay}
        />
      </div>
      {body ? (
        <p
          className={cn(veil && "particle-veil", "mt-6 w-fit max-w-[52ch] text-lede text-pretty text-ink-muted")}
          data-network-quiet={quiet}
        >
          {body}
        </p>
      ) : null}
    </div>
  );
}
