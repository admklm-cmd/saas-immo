import { APP_TEXTS } from "@/components/texts";
import { Skeleton } from "@/components/ui/Skeleton";

/** Same shape as the dashboard: the pipeline frieze, the « À faire » rows, agents and appointments. */
export default function DashboardLoading() {
  return (
    <div aria-busy="true" aria-label={APP_TEXTS.states.loading} className="page-frame">
      <Skeleton className="h-10 w-72 max-w-full sm:h-12" />
      <Skeleton className="mt-4 h-5 w-120 max-w-full" />
      <Skeleton className="mt-4 h-6 w-64 max-w-full rounded-full" />

      <div className="mt-10 rounded-2xl border border-line bg-surface px-5 pt-6 pb-5 sm:px-8 sm:pt-8 lg:mt-12">
        <Skeleton className="h-7 w-64 max-w-full" />
        <Skeleton className="mt-2 h-4 w-80 max-w-full" />
        <div className="mt-8 hidden items-end gap-4 xl:flex">
          {Array.from({ length: 9 }, (_, step) => (
            <div key={step} className="flex flex-1 flex-col items-center gap-3">
              <Skeleton className="h-20 w-2 rounded-full" />
              <Skeleton className="size-3 rounded-full" />
              <Skeleton className="h-8 w-12" />
              <Skeleton className="h-3 w-16" />
            </div>
          ))}
        </div>
        <div className="mt-6 flex flex-col gap-4 xl:hidden">
          {Array.from({ length: 6 }, (_, step) => (
            <div key={step} className="flex items-center gap-4">
              <Skeleton className="size-3 rounded-full" />
              <Skeleton className="h-8 w-32" />
              <Skeleton className="ml-auto h-3 w-20" />
            </div>
          ))}
        </div>
      </div>

      <Skeleton className="mt-14 h-7 w-56" />
      <div className="mt-5 divide-y divide-line rounded-2xl border border-line bg-surface">
        {Array.from({ length: 5 }, (_, row) => (
          <div key={row} className="flex flex-col gap-4 px-6 py-5 xl:flex-row">
            <div className="flex gap-4 xl:w-72">
              <Skeleton className="size-10 rounded-full" />
              <div className="flex flex-col gap-2">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-8 w-40" />
              </div>
            </div>
            <Skeleton className="h-20 flex-1 rounded-lg" />
          </div>
        ))}
      </div>

      <div className="mt-14 grid gap-6 xl:grid-cols-2">
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
