import { APP_TEXTS } from "@/components/texts";
import { Skeleton } from "@/components/ui/Skeleton";

const ROWS = 5;

/** Same shape as the sieve: the summary band, then compact rows with their gates. */
export default function EmmaFollowUpsLoading() {
  return (
    <div aria-busy="true" aria-label={APP_TEXTS.states.loading} className="page-frame">
      <Skeleton className="h-11 w-72 max-w-full" />
      <Skeleton className="mt-4 h-4 w-[36rem] max-w-full" />
      <Skeleton className="mt-4 h-6 w-40 rounded-full" />

      <div className="mt-10 rounded-2xl border border-line bg-surface p-8">
        <div className="grid grid-cols-5 items-center gap-6">
          {Array.from({ length: 5 }, (_, step) => (
            <div key={step} className="flex flex-col items-center gap-3">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="size-4 rounded-full" />
              <Skeleton className="h-6 w-14" />
            </div>
          ))}
        </div>
      </div>

      <div className="mt-8 overflow-hidden rounded-2xl border border-line bg-surface">
        <div className="px-6 py-5">
          <Skeleton className="h-6 w-24" />
        </div>
        {Array.from({ length: ROWS }, (_, row) => (
          <div key={row} className="flex items-center justify-between gap-6 border-t border-line px-6 py-4">
            <div>
              <Skeleton className="h-4 w-40" />
              <Skeleton className="mt-2 h-3 w-56" />
            </div>
            <Skeleton className="hidden h-2 w-80 md:block" />
            <Skeleton className="h-10 w-44 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
