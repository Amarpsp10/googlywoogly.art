"use client";

import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts";

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

/**
 * Traffic-over-time chart (docs/13 FR-24) — a small **client leaf** rendered
 * inside the RSC analytics page, which passes the already-aggregated by-day
 * series in. Stacked-ish area chart of visitors / sessions / pageviews over the
 * selected IST-day range, using the warm theme tokens via `ChartContainer`'s
 * `--color-*` variables. Responsive + touch-legible (mobile-first).
 *
 * The series is server-computed; this component is presentation only (no fetch,
 * no PII — just counts + day labels).
 */

export interface TrafficChartPoint {
  /** IST-day label, pre-formatted server-side (e.g. "12 Jun"). */
  label: string;
  visitors: number;
  sessions: number;
  pageviews: number;
}

const CHART_CONFIG = {
  pageviews: { label: "Pageviews", color: "var(--chart-3)" },
  sessions: { label: "Sessions", color: "var(--chart-2)" },
  visitors: { label: "Visitors", color: "var(--chart-1)" },
} satisfies ChartConfig;

export function TrafficChart({ data }: { data: TrafficChartPoint[] }) {
  // A single solid-ish gradient per series id, derived from the CSS var.
  const fills = useMemo(
    () => ["visitors", "sessions", "pageviews"] as const,
    [],
  );

  return (
    <ChartContainer config={CHART_CONFIG} className="aspect-auto h-[260px] w-full">
      <AreaChart data={data} margin={{ left: 4, right: 8, top: 8, bottom: 0 }}>
        <defs>
          {fills.map((id) => (
            <linearGradient key={id} id={`fill-${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={`var(--color-${id})`} stopOpacity={0.35} />
              <stop offset="95%" stopColor={`var(--color-${id})`} stopOpacity={0.02} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={16}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={32}
          allowDecimals={false}
          tickMargin={4}
        />
        <ChartTooltip cursor content={<ChartTooltipContent indicator="dot" />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Area
          dataKey="pageviews"
          type="monotone"
          stroke="var(--color-pageviews)"
          fill="url(#fill-pageviews)"
          strokeWidth={2}
          stackId="a"
        />
        <Area
          dataKey="sessions"
          type="monotone"
          stroke="var(--color-sessions)"
          fill="url(#fill-sessions)"
          strokeWidth={2}
          stackId="b"
        />
        <Area
          dataKey="visitors"
          type="monotone"
          stroke="var(--color-visitors)"
          fill="url(#fill-visitors)"
          strokeWidth={2}
          stackId="c"
        />
      </AreaChart>
    </ChartContainer>
  );
}
