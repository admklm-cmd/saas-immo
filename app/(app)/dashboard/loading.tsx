import { APP_TEXTS } from "@/components/texts";
import { Skeleton } from "@/components/ui/Skeleton";

/** Same shape as the dashboard: five action cards, the pipeline, agents and appointments. */
export default function DashboardLoading() {
  return (
    <div
      aria-busy="true"
      aria-label={APP_TEXTS.states.loading}
      className="mx-auto w-full max-w-7xl px-6 py-10 lg:px-10 lg:py-12"
    >
      <Skeleton className="h-9 w-56" />
      <Skeleton className="mt-3 h-4 w-96 max-w-full" />
      <Skeleton className="mt-4 h-6 w-64 max-w-full rounded-full" />

      <Skeleton className="mt-10 h-6 w-48" />
      <div className="mt-5 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 5 }, (_, card) => (
          <div key={card} className="rounded-xl border border-line bg-surface p-6">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="mt-4 h-9 w-16" />
            <Skeleton className="mt-2 h-3 w-32" />
            <div className="mt-5 flex flex-col gap-3 border-t border-line pt-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-12 rounded-xl border border-line bg-surface p-6">
        <Skeleton className="h-6 w-32" />
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }, (_, stage) => (
            <Skeleton key={stage} className="h-24 w-full rounded-lg" />
          ))}
        </div>
      </div>

      <div className="mt-12 grid gap-6 lg:grid-cols-2">
        {Array.from({ length: 2 }, (_, card) => (
          <div key={card} className="rounded-xl border border-line bg-surface p-6">
            <Skeleton className="h-6 w-44" />
            <Skeleton className="mt-4 h-4 w-64 max-w-full" />
            <Skeleton className="mt-6 h-28 w-full rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}
