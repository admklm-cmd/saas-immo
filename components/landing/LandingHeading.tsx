import { cn } from "@/components/ui/cn";

type LandingHeadingProps = {
  id: string;
  kicker?: string;
  title: string;
  body?: string;
  className?: string;
};

/**
 * Heading of a landing section: overline, editorial h2, one paragraph. Posed
 * on a local veil so it stays AA above the living background.
 */
export function LandingHeading({ id, kicker, title, body, className }: LandingHeadingProps) {
  return (
    <div className={cn("particle-veil max-w-3xl", className)}>
      {kicker ? <p className="text-overline font-semibold text-ink-subtle uppercase">{kicker}</p> : null}
      <h2
        id={id}
        className="mt-5 text-[clamp(2.25rem,4.8vw,4.5rem)] leading-[1] font-semibold tracking-[-0.05em] text-balance text-ink"
      >
        {title}
      </h2>
      {body ? <p className="mt-6 max-w-2xl text-base leading-relaxed text-pretty text-ink-muted">{body}</p> : null}
    </div>
  );
}
