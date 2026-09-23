import { cn } from "./cn";

/** Decorative only: the containing control/notice provides its real accessible state. */
export function MotionDots({ kind = "loading", className }: { kind?: "loading" | "pending" | "error"; className?: string }) {
  return <span aria-hidden="true" className={cn("motion-dots", `motion-dots-${kind}`, className)}><i /><i /><i /></span>;
}
