import { APP_TEXTS } from "@/components/texts";
import { Skeleton } from "@/components/ui/Skeleton";

const ROWS = 5;

export default function TasksLoading() {
  return (
    <div
      aria-busy="true"
      aria-label={APP_TEXTS.states.loading}
      className="mx-auto w-full max-w-4xl px-6 py-10 lg:px-10 lg:py-12"
    >
      <Skeleton className="h-9 w-32" />
      <Skeleton className="mt-3 h-4 w-[30rem] max-w-full" />

      <div className="mt-8 flex flex-wrap items-end justify-between gap-x-8 gap-y-5">
        <div>
          <Skeleton className="h-9 w-40" />
          <Skeleton className="mt-2 h-3 w-24" />
        </div>
        <Skeleton className="h-10 w-72 max-w-full rounded-full" />
      </div>

      <div className="mt-6 divide-y divide-line rounded-xl border border-line bg-surface">
        {Array.from({ length: ROWS }, (_, row) => (
          <div key={row} className="flex flex-col gap-4 px-6 py-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex-1">
              <Skeleton className="h-5 w-80 max-w-full" />
              <Skeleton className="mt-2 h-4 w-40" />
              <Skeleton className="mt-3 h-3 w-56" />
            </div>
            <Skeleton className="h-8 w-44 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
