import { APP_TEXTS } from "@/components/texts";
import { Skeleton } from "@/components/ui/Skeleton";

export default function PipelineLoading() {
  return (
    <div
      aria-busy="true"
      aria-label={APP_TEXTS.states.loading}
      className="mx-auto w-full max-w-7xl px-6 py-10 lg:px-10 lg:py-12"
    >
      <Skeleton className="h-9 w-40" />
      <Skeleton className="mt-3 h-4 w-80 max-w-full" />

      <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, column) => (
          <div key={column} className="rounded-xl border border-line bg-surface p-4">
            <div className="flex items-center justify-between gap-2">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <div className="mt-4 flex flex-col gap-2">
              <Skeleton className="h-14 w-full rounded-lg" />
              <Skeleton className="h-14 w-full rounded-lg" />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 max-w-sm border-t border-line pt-6">
        <Skeleton className="h-3 w-64 max-w-full" />
        <div className="mt-3 rounded-xl border border-dashed border-line-strong bg-surface-muted p-4">
          <div className="flex items-center justify-between gap-2">
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <Skeleton className="mt-4 h-14 w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}
