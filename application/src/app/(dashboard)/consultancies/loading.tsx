import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

export default function ConsultanciesLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-4 w-32" />
        </div>
        <Skeleton className="h-10 w-40" />
      </div>
      <div className="flex flex-col gap-3 md:flex-row">
        <Skeleton className="h-11 w-full md:h-9 md:w-72" />
        <Skeleton className="h-11 w-full md:h-9 md:w-48" />
        <Skeleton className="h-11 w-full md:h-9 md:w-40" />
      </div>
      <Card className="p-5">
        <div className="flex flex-col gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </Card>
    </div>
  );
}
