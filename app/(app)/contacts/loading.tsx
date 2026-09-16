import { APP_TEXTS } from "@/components/texts";
import { Skeleton } from "@/components/ui/Skeleton";

const ROWS = 6;

export default function ContactsLoading() {
  return (
    <div
      aria-busy="true"
      aria-label={APP_TEXTS.states.loading}
      className="mx-auto w-full max-w-7xl px-6 py-10 lg:px-10 lg:py-12"
    >
      <Skeleton className="h-9 w-72" />
      <Skeleton className="mt-3 h-4 w-96" />

      <div className="mt-8 overflow-hidden rounded-xl border border-line bg-surface">
        <div className="border-b border-line bg-surface-muted px-5 py-3">
          <Skeleton className="h-3 w-40" />
        </div>
        {Array.from({ length: ROWS }, (_, row) => (
          <div key={row} className="flex items-center gap-6 border-b border-line px-5 py-4 last:border-b-0">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-6 w-28 rounded-full" />
            <Skeleton className="h-4 w-56" />
            <Skeleton className="ml-auto h-4 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}
