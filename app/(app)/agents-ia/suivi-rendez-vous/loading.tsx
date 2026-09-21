import { APP_TEXTS } from "@/components/texts";
import { Skeleton } from "@/components/ui/Skeleton";

const CARDS = 3;

export default function FollowThroughLoading() {
  return (
    <div
      aria-busy="true"
      aria-label={APP_TEXTS.states.loading}
      className="mx-auto w-full max-w-4xl px-6 py-10 lg:px-10 lg:py-12"
    >
      <Skeleton className="h-9 w-72" />
      <Skeleton className="mt-3 h-4 w-[34rem] max-w-full" />
      <Skeleton className="mt-8 h-20 w-full rounded-lg" />
      <div className="mt-8 flex flex-col gap-6">
        {Array.from({ length: CARDS }, (_, card) => (
          <div key={card} className="rounded-xl border border-line bg-surface p-6">
            <div className="flex items-start justify-between gap-6">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-6 w-32 rounded-full" />
            </div>
            <Skeleton className="mt-3 h-4 w-56" />
            <Skeleton className="mt-6 h-28 w-full rounded-lg" />
            <Skeleton className="mt-5 h-10 w-32 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
