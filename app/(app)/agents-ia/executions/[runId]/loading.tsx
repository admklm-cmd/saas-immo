import { APP_TEXTS } from "@/components/texts";
import { Skeleton } from "@/components/ui/Skeleton";

const STEPS = 5;

export default function AgentRunLoading() {
  return (
    <div
      aria-busy="true"
      aria-label={APP_TEXTS.states.loading}
      className="mx-auto w-full max-w-4xl px-6 py-10 lg:py-12"
    >
      <Skeleton className="h-4 w-28" />
      <Skeleton className="mt-4 h-9 w-72" />

      <div className="mt-8 rounded-xl border border-line bg-surface p-6">
        <Skeleton className="h-5 w-48" />
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 6 }, (_, item) => (
            <Skeleton key={item} className="h-4 w-40" />
          ))}
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-line bg-surface p-6">
        <Skeleton className="h-5 w-40" />
        <div className="mt-5 flex flex-col gap-5">
          {Array.from({ length: STEPS }, (_, step) => (
            <div key={step} className="flex gap-4">
              <Skeleton className="size-5 shrink-0 rounded-full" />
              <div className="flex-1">
                <Skeleton className="h-3 w-32" />
                <Skeleton className="mt-2 h-4 w-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
