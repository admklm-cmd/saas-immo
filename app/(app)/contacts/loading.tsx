import { APP_TEXTS } from "@/components/texts";
import { Skeleton } from "@/components/ui/Skeleton";

const ROWS = 8;

/** Same shape as the list: a table from 768 px, cards on a phone. */
export default function ContactsLoading() {
  return (
    <div aria-busy="true" aria-label={APP_TEXTS.states.loading} className="page-frame">
      <Skeleton className="h-10 w-72 max-w-full sm:h-12" />
      <Skeleton className="mt-3 h-4 w-96 max-w-full" />
      <Skeleton className="mt-4 h-6 w-24 rounded-full" />

      <div className="mt-8 hidden overflow-hidden rounded-2xl border border-line bg-surface md:block">
        <div className="border-b border-line bg-surface-muted px-5 py-3">
          <Skeleton className="h-3 w-40" />
        </div>
        {Array.from({ length: ROWS }, (_, row) => (
          <div key={row} className="flex items-center gap-8 border-b border-line px-5 py-4 last:border-b-0">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-6 w-28 rounded-full" />
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-8 w-52" />
            <Skeleton className="ml-auto h-4 w-24" />
          </div>
        ))}
      </div>

      <div className="mt-8 flex flex-col gap-2.5 md:hidden">
        {Array.from({ length: 5 }, (_, card) => (
          <div key={card} className="rounded-2xl border border-line bg-surface px-4 py-3.5">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="mt-3 h-6 w-28 rounded-full" />
            <Skeleton className="mt-3 h-4 w-full" />
            <Skeleton className="mt-2 h-3 w-3/4" />
          </div>
        ))}
      </div>
    </div>
  );
}
