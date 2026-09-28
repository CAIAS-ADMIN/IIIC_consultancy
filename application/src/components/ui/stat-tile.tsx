import Link from "next/link";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

export function StatTile({
  label,
  value,
  tone = "neutral",
  href,
  size = "md",
  className,
}: {
  label: string;
  value: React.ReactNode;
  tone?: "neutral" | "accent" | "primary" | "danger";
  /** Drill-down target (spec §67: KPI → filtered list → record). */
  href?: string;
  size?: "md" | "sm";
  className?: string;
}) {
  const toneClass = {
    neutral: "text-foreground",
    accent: "text-accent-strong",
    primary: "text-primary",
    danger: "text-status-danger-fg",
  }[tone];

  const card = (
    <Card className={cn(size === "sm" ? "h-full p-4" : "h-full p-5", href && "transition-colors hover:border-primary", className)}>
      <p className={cn("text-muted-foreground", size === "sm" ? "text-xs" : "text-sm")}>{label}</p>
      <p className={cn("font-semibold", size === "sm" ? "mt-1 text-2xl" : "mt-2 text-3xl", toneClass)}>{value}</p>
    </Card>
  );

  if (!href) return card;
  return (
    <Link href={href} className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      {card}
    </Link>
  );
}
