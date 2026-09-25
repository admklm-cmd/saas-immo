import { APP_TEXTS } from "@/components/texts";
import { Skeleton } from "@/components/ui/Skeleton";

const COLUMNS = 6;
const CARDS = [3, 2, 2, 1, 1, 1];

/**
 * Same shape as the board: the map of the stages, then six columns on one
 * line (their nodes on the line of the journey), then the lost lane apart.
 */
export default function PipelineLoading() {
  return (
    <div aria-busy="true" aria-label={APP_TEXTS.states.loading} className="page-frame">
      <Skeleton className="h-10 w-48 sm:h-12" />
      <Skeleton className="mt-3 h-4 w-96 max-w-full" />
      <Skeleton className="mt-4 h-6 w-24 rounded-full" />

      <div className="mt-8 flex gap-2">
        {Array.from({ length: COLUMNS }, (_, index) => (
          <div key={index} className="min-w-0 flex-1 pt-1.5">
            <div className="h-0.5 rounded-full bg-line-strong" />
            <Skeleton className="mt-2 h-3 w-3/4 max-sm:w-4" />
          </div>
        ))}
        <div className="w-14 shrink-0 pt-1.5 pl-1.5 sm:w-24 sm:pl-3">
          <div className="border-t-2 border-dotted border-line-strong" />
          <Skeleton className="mt-2 h-3 w-10" />
        </div>
      </div>

      <div className="mt-6 flex gap-3 overflow-hidden">
        {Array.from({ length: COLUMNS }, (_, column) => (
          <div key={column} className="w-[calc(100%-2.75rem)] shrink-0 sm:w-64 sm:flex-1">
            <div className="relative flex h-7 items-center">
              {column < COLUMNS - 1 ? <span className="absolute top-1/2 -right-3 left-1 h-px bg-line-strong" /> : null}
              <span className="relative block size-2.5 rounded-full border-[1.5px] border-line-strong bg-surface" />
            </div>
            <Skeleton className="mt-3 h-5 w-28" />
            <Skeleton className="mt-3 h-7 w-20" />
            <div className="mt-4 flex flex-col gap-2.5">
              {Array.from({ length: CARDS[column] ?? 1 }, (_, card) => (
                <Skeleton key={card} className="h-20 w-full rounded-xl" />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-2xl border border-dashed border-line-strong bg-surface-muted p-5">
        <div className="flex items-center gap-4">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-6 w-20" />
        </div>
        <Skeleton className="mt-4 h-20 w-full rounded-xl sm:w-64" />
      </div>
    </div>
  );
}
