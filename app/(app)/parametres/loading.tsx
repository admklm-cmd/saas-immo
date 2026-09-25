import { APP_TEXTS } from "@/components/texts";
import { Skeleton } from "@/components/ui/Skeleton";

/** Same shape as the real screen, so nothing jumps when the settings arrive. */
export default function SettingsLoading() {
  return (
    <div
      aria-busy="true"
      aria-label={APP_TEXTS.states.loading}
      className="page-frame page-frame-medium"
    >
      <Skeleton className="h-9 w-48" />
      <Skeleton className="mt-3 h-4 w-full max-w-[28rem]" />
      <Skeleton className="mt-4 h-6 w-28 rounded-full" />
      <Skeleton className="mt-8 h-20 w-full rounded-lg" />

      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        {[0, 1].map((card) => (
          <div key={card} className="rounded-xl border border-line bg-surface p-6">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="mt-3 h-4 w-60" />
            <Skeleton className="mt-6 h-4 w-48" />
            <Skeleton className="mt-3 h-4 w-40" />
            <Skeleton className="mt-3 h-4 w-44" />
          </div>
        ))}
      </div>

      <Skeleton className="mt-12 h-6 w-32" />
      <div className="mt-5 grid gap-6 lg:grid-cols-2">
        {[0, 1].map((card) => (
          <div key={card} className="rounded-xl border border-line bg-surface p-6">
            <Skeleton className="h-5 w-56" />
            <Skeleton className="mt-3 h-4 w-72 max-w-full" />
            <Skeleton className="mt-6 h-10 w-52 rounded-full" />
          </div>
        ))}
      </div>

      <div className="mt-12 rounded-xl border border-line bg-surface p-6">
        <Skeleton className="h-5 w-36" />
        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          {[0, 1, 2].map((group) => (
            <div key={group}>
              <Skeleton className="h-3 w-28" />
              <Skeleton className="mt-3 h-24 w-full rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
