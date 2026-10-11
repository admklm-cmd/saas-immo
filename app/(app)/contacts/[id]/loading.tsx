import { APP_TEXTS } from "@/components/texts";
import { Skeleton } from "@/components/ui/Skeleton";

function CardSkeleton({ lines }: { lines: number }) {
  return (
    <div className="rounded-xl border border-line bg-surface">
      <div className="border-b border-line px-6 py-5">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="mt-2 h-3 w-64" />
      </div>
      <div className="flex flex-col gap-3 px-6 py-5">
        {Array.from({ length: lines }, (_, line) => (
          <Skeleton key={line} className="h-4 w-full" />
        ))}
      </div>
    </div>
  );
}

export default function ContactDetailLoading() {
  return (
    <div
      aria-busy="true"
      aria-label={APP_TEXTS.states.loading}
      className="page-frame"
    >
      <Skeleton className="h-4 w-40" />
      <Skeleton className="mt-4 h-9 w-80" />
      <div className="mt-4 flex gap-2">
        <Skeleton className="h-6 w-28 rounded-full" />
        <Skeleton className="h-6 w-36 rounded-full" />
      </div>

      <div className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-w-0 flex-col gap-6">
          <CardSkeleton lines={4} />
          <CardSkeleton lines={3} />
          <CardSkeleton lines={6} />
        </div>
        <div className="flex flex-col gap-6">
          <CardSkeleton lines={2} />
          <CardSkeleton lines={4} />
        </div>
      </div>
    </div>
  );
}
