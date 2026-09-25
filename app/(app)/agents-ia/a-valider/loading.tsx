import { APP_TEXTS } from "@/components/texts";
import { Skeleton } from "@/components/ui/Skeleton";

const ITEMS = 4;

/** Same shape as the dual view: queue on the left, rail and letter on the right. */
export default function MessagesToValidateLoading() {
  return (
    <div aria-busy="true" aria-label={APP_TEXTS.states.loading} className="page-frame">
      <Skeleton className="h-11 w-80 max-w-full" />
      <Skeleton className="mt-4 h-4 w-[30rem] max-w-full" />
      <Skeleton className="mt-8 h-12 w-[40rem] max-w-full rounded-lg" />

      <div className="mt-8 grid overflow-hidden rounded-2xl border border-line bg-surface xl:grid-cols-[20rem_minmax(0,1fr)]">
        <div className="flex flex-col gap-2 p-4 xl:border-r xl:border-line">
          <Skeleton className="mb-2 h-3 w-24" />
          {Array.from({ length: ITEMS }, (_, item) => (
            <div key={item} className="flex gap-3 rounded-lg p-3">
              <Skeleton className="size-7 shrink-0 rounded-md" />
              <div className="flex-1">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="mt-2 h-3 w-44" />
                <Skeleton className="mt-3 h-3 w-24" />
              </div>
            </div>
          ))}
        </div>
        <div className="hidden bg-surface-muted p-10 xl:block">
          <div className="grid grid-cols-3 justify-items-center gap-4">
            {Array.from({ length: 3 }, (_, node) => (
              <div key={node} className="flex flex-col items-center gap-2">
                <Skeleton className="size-10 rounded-full" />
                <Skeleton className="h-3 w-24" />
              </div>
            ))}
          </div>
          <div className="mt-8 rounded-3xl border border-line bg-surface p-8">
            <Skeleton className="h-3 w-12" />
            <Skeleton className="mt-3 h-6 w-48" />
            <Skeleton className="mt-8 h-4 w-72" />
            <Skeleton className="mt-6 h-24 w-full rounded-lg" />
          </div>
          <div className="mt-6 flex gap-2">
            <Skeleton className="h-10 w-28 rounded-full" />
            <Skeleton className="h-10 w-28 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
