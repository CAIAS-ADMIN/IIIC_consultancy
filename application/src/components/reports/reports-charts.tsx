"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type ChartDataItem = {
  label: string;
  value: number;
  color?: string;
};

/** Horizontal bar chart component using CSS bars and design system tokens. */
export function HorizontalBarChart({
  title,
  subtitle,
  data,
  valuePrefix = "",
  valueSuffix = "",
  formatValue,
}: {
  title: string;
  subtitle?: string;
  data: ChartDataItem[];
  valuePrefix?: string;
  valueSuffix?: string;
  formatValue?: (value: number) => string;
}) {
  const maxValue = Math.max(...data.map((d) => d.value), 1);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold text-foreground">{title}</CardTitle>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">No data available</p>
        ) : (
          <div className="flex flex-col gap-3">
            {data.map((item) => {
              const percentage = Math.round((item.value / maxValue) * 100);
              const barColor = item.color || "bg-primary";

              return (
                <div key={item.label} className="flex flex-col gap-1">
                  <div className="flex justify-between gap-3 text-xs font-medium">
                    <span className="min-w-0 break-words text-foreground">
                      {item.label}
                    </span>
                    <span className="shrink-0 text-muted-foreground font-mono">
                      {formatValue ? formatValue(item.value) : `${valuePrefix}${item.value.toLocaleString()}${valueSuffix}`}
                    </span>
                  </div>
                  <div className="h-2.5 w-full rounded-full bg-status-neutral-bg overflow-hidden" aria-hidden>
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                      style={{ width: `${Math.max(percentage, 2)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** More slices than this can't get distinct colors (or be told apart on a phone), so the chart falls back to bars. */
const MAX_DONUT_SLICES = 6;

/** One token per possible slice (see `--chart-*` in globals.css) — never hardcoded hex here. */
const CHART_SERIES_COLORS = Array.from({ length: MAX_DONUT_SLICES }, (_, i) => `var(--chart-${i + 1})`);

/** Simple SVG Donut/Pie visual distribution chart — becomes a sorted bar chart above `MAX_DONUT_SLICES` categories. */
export function DonutChart({
  title,
  subtitle,
  data,
}: {
  title: string;
  subtitle?: string;
  data: ChartDataItem[];
}) {
  const total = data.reduce((acc, d) => acc + d.value, 0);

  if (data.length > MAX_DONUT_SLICES) {
    return <HorizontalBarChart title={title} subtitle={subtitle} data={[...data].sort((a, b) => b.value - a.value)} />;
  }

  const segments = data.map((item, i) => {
    const startAngle = total > 0 ? (data.slice(0, i).reduce((acc, d) => acc + d.value, 0) / total) * 360 : 0;
    return {
      ...item,
      color: item.color || CHART_SERIES_COLORS[i % CHART_SERIES_COLORS.length],
      startAngle,
      percentage: total > 0 ? Math.round((item.value / total) * 100) : 0,
    };
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold text-foreground">{title}</CardTitle>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">No data available</p>
        ) : (
          <div className="flex flex-col sm:flex-row items-center gap-6">
            {/* SVG Donut */}
            <div className="relative w-36 h-36 shrink-0 flex items-center justify-center">
              <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90" aria-hidden>
                {segments.map((s, idx) => {
                  if (s.value === 0) return null;
                  const r = 38;
                  const cx = 50;
                  const cy = 50;
                  const circumference = 2 * Math.PI * r;
                  const strokeDasharray = `${(s.value / total) * circumference} ${circumference}`;
                  const strokeDashoffset = -((s.startAngle / 360) * circumference);

                  return (
                    <circle
                      key={idx}
                      cx={cx}
                      cy={cy}
                      r={r}
                      fill="transparent"
                      style={{ stroke: s.color }}
                      strokeWidth="16"
                      strokeDasharray={strokeDasharray}
                      strokeDashoffset={strokeDashoffset}
                      className="transition-all duration-300"
                    />
                  );
                })}
              </svg>
              <div className="absolute flex flex-col items-center justify-center text-center" aria-hidden>
                <span className="text-lg font-bold text-foreground">{total}</span>
                <span className="text-[10px] text-muted-foreground uppercase font-medium">Total</span>
              </div>
            </div>

            {/* Legend */}
            <div className="flex flex-col gap-2 w-full">
              {segments.map((s) => (
                <div key={s.label} className="flex items-center justify-between gap-3 text-xs">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: s.color }} aria-hidden />
                    <span className="min-w-0 break-words text-foreground">
                      {s.label}
                    </span>
                  </div>
                  <span className="shrink-0 font-semibold text-foreground font-mono">
                    {s.value} <span className="text-muted-foreground font-normal">({s.percentage}%)</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
