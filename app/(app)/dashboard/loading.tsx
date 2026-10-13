import { APP_TEXTS } from "@/components/texts";
import { Skeleton } from "@/components/ui/Skeleton";

/** Same three surfaces as the page: the black Scène, the Feuille and the Atelier, at their final height. */
export default function DashboardLoading() {
  return (
    <div aria-busy="true" aria-label={APP_TEXTS.states.loading} className="page-frame">
      <Skeleton className="mb-3 h-(--text-overline) w-24" />
      <Skeleton className="h-10 w-72 max-w-full sm:h-12" />
      <Skeleton className="mt-4 h-6 w-48 max-w-full rounded-full" />

      <div className="mt-8 flex flex-col gap-3 lg:mt-10 lg:flex-row lg:items-center lg:justify-between">
        <Skeleton className="h-11 w-full rounded-full lg:h-10 lg:w-88" />
        <Skeleton className="h-6 w-full max-w-md" />
      </div>

      <div className="mt-6 flex flex-col gap-6">
        <div className="rounded-[1.25rem] bg-stage p-6 sm:rounded-3xl sm:p-10 lg:min-h-132">
          <div className="grid gap-8 lg:grid-cols-[19rem_minmax(0,1fr)]">
            <div>
              <div className="h-3 w-40 rounded-full bg-stage-grid" />
              <div className="mt-8 h-32 w-48 rounded-lg bg-stage-grid" />
              <div className="mt-6 h-4 w-56 rounded-full bg-stage-grid" />
            </div>
            <div className="h-64 rounded-lg bg-stage-grid lg:h-88" />
          </div>
        </div>
        <div className="rounded-[1.25rem] border border-line bg-surface p-6 sm:rounded-3xl sm:p-10">
          <div className="grid gap-8 md:grid-cols-3">
            {[0, 1, 2].map((item) => (
              <div key={item}>
                <Skeleton className="h-3 w-32" />
                <Skeleton className="mt-4 h-16 w-40" />
                <Skeleton className="mt-4 h-4 w-full" />
              </div>
            ))}
          </div>
          <Skeleton className="mt-10 h-72 w-full rounded-lg" />
        </div>
        <Skeleton className="h-96 w-full rounded-3xl" />
      </div>
    </div>
  );
}
