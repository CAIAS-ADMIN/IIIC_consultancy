import type { LucideIcon } from "lucide-react";
import { Construction } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

/**
 * Shared placeholder for any nav destination whose real screen hasn't been
 * built yet (Phase 2+ overwrite these one at a time). Keeps every link in
 * the shell's nav from 404ing while a phase is still in flight.
 */
export function ComingSoon({
  feature,
  icon: Icon = Construction,
}: {
  feature: string;
  icon?: LucideIcon;
}) {
  return (
    <div className="flex flex-1 items-center justify-center py-16">
      <EmptyState
        icon={Icon}
        title={feature}
        description="This screen is coming in a later phase."
      />
    </div>
  );
}
