import Link from "next/link";
import { SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export default function DashboardNotFound() {
  return (
    <EmptyState
      icon={SearchX}
      title="We couldn't find that"
      description="It may have been removed, or the link may be wrong."
      action={
        <Button asChild>
          <Link href="/dashboard">Go to dashboard</Link>
        </Button>
      }
      className="mt-8"
    />
  );
}
