import { APP_TEXTS } from "@/components/texts";
import { Skeleton } from "@/components/ui/Skeleton";

const CARDS = 3;

export default function InboundLeadsLoading() {
  return (
    <div
      aria-busy="true"
      aria-label={APP_TEXTS.states.loading}
      className="page-frame page-frame-reading"
    >
      <Skeleton className="h-9 w-64" />
      <Skeleton className="mt-3 h-4 w-[28rem]" />
      <Skeleton className="mt-8 h-16 w-full rounded-lg" />

      <div className="mt-8 flex flex-col gap-6">
        {Array.from({ length: CARDS }, (_, card) => (
          <div key={card} className="rounded-xl border border-line bg-surface p-6">
            <div className="flex items-start justify-between gap-6">
              <Skeleton className="h-5 w-56" />
              <Skeleton className="h-6 w-24 rounded-full" />
            </div>
            <Skeleton className="mt-4 h-4 w-72" />
            <Skeleton className="mt-4 h-24 w-full rounded-lg" />
            <Skeleton className="mt-5 h-10 w-36 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
