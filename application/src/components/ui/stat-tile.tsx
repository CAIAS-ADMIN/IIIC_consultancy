import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

export function StatTile({
  label,
  value,
  tone = "neutral",
  className,
}: {
  label: string;
  value: React.ReactNode;
  tone?: "neutral" | "accent" | "primary" | "danger";
  className?: string;
}) {
  const toneClass = {
    neutral: "text-foreground",
    accent: "text-accent-strong",
    primary: "text-primary",
    danger: "text-status-danger-fg",
  }[tone];

  return (
    <Card className={cn("p-5", className)}>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={cn("mt-2 text-3xl font-semibold", toneClass)}>{value}</p>
    </Card>
  );
}
