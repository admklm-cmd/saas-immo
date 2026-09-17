import { APP_TEXTS } from "@/components/texts";
import { Skeleton } from "@/components/ui/Skeleton";

const AGENTS = 5;
const ROWS = 5;

/** Same shape as the real screen, so nothing jumps when the data arrives. */
export default function AgentsIaLoading() {
  return (
    <div
      aria-busy="true"
      aria-label={APP_TEXTS.states.loading}
      className="mx-auto w-full max-w-7xl px-6 py-10 lg:px-10 lg:py-12"
    >
      <Skeleton className="h-9 w-64" />
      <Skeleton className="mt-3 h-4 w-[28rem]" />

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        {[0, 1].map((panel) => (
          <div key={panel} className="rounded-xl border border-line bg-surface p-6">
            <Skeleton className="h-5 w-56" />
            <Skeleton className="mt-3 h-4 w-72" />
            <Skeleton className="mt-6 h-10 w-52 rounded-full" />
          </div>
        ))}
      </div>

      <div className="mt-12 grid gap-6 lg:grid-cols-2 2xl:grid-cols-3">
        {Array.from({ length: AGENTS }, (_, card) => (
          <div key={card} className="rounded-xl border border-line bg-surface p-6">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="mt-3 h-4 w-full" />
            <Skeleton className="mt-2 h-4 w-3/4" />
            <Skeleton className="mt-6 h-4 w-40" />
            <Skeleton className="mt-2 h-4 w-48" />
          </div>
        ))}
      </div>

      <div className="mt-12 overflow-hidden rounded-xl border border-line bg-surface">
        <div className="border-b border-line bg-surface-muted px-5 py-3">
          <Skeleton className="h-3 w-48" />
        </div>
        {Array.from({ length: ROWS }, (_, row) => (
          <div key={row} className="flex items-center gap-6 border-b border-line px-5 py-4 last:border-b-0">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-6 w-24 rounded-full" />
            <Skeleton className="h-4 w-64" />
            <Skeleton className="ml-auto h-4 w-28" />
          </div>
        ))}
      </div>
    </div>
  );
}
