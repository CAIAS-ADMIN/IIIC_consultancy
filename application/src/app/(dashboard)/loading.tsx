import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

/** Fallback skeleton for any signed-in screen without its own `loading.tsx` — no screen flashes blank while its data loads. */
export default function DashboardGroupLoading() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-40" />
      </div>
      <Card className="p-5">
        <div className="flex flex-col gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </Card>
    </div>
  );
}
