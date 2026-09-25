import { APP_TEXTS } from "@/components/texts";
import { Skeleton } from "@/components/ui/Skeleton";

const ROWS = 4;

export default function AppointmentsLoading() {
  return (
    <div
      aria-busy="true"
      aria-label={APP_TEXTS.states.loading}
      className="page-frame page-frame-reading"
    >
      <Skeleton className="h-9 w-72 max-w-full" />
      <Skeleton className="mt-3 h-4 w-[30rem] max-w-full" />
      <Skeleton className="mt-4 h-6 w-24 rounded-full" />

      <div className="mt-8 flex flex-wrap items-end justify-between gap-x-8 gap-y-5">
        <div>
          <Skeleton className="h-9 w-36" />
          <Skeleton className="mt-2 h-3 w-56" />
        </div>
        <Skeleton className="h-10 w-48 rounded-full" />
      </div>

      <div className="mt-6 divide-y divide-line rounded-xl border border-line bg-surface">
        {Array.from({ length: ROWS }, (_, row) => (
          <div key={row} className="flex gap-5 px-6 py-5">
            <Skeleton className="size-14 shrink-0 rounded-lg" />
            <div className="flex-1">
              <Skeleton className="h-5 w-72 max-w-full" />
              <Skeleton className="mt-2 h-4 w-36" />
              <div className="mt-3 flex gap-1.5">
                <Skeleton className="h-6 w-20 rounded-full" />
                <Skeleton className="h-6 w-24 rounded-full" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
