"use client";

import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  XAxis,
  YAxis,
} from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

/**
 * Conversion-funnel viz (docs/13 FR-26) — a small **client leaf** fed the
 * already-computed 5-step funnel by the RSC page. Rendered as a horizontal bar
 * chart (vertical layout) so the steps read top-to-bottom on mobile, each bar
 * proportional to its absolute count. Per-step rates / drop-off are shown in the
 * accompanying RSC table on the page (this leaf is the visual only).
 *
 * Counts are non-identifying aggregates; no fetch, no PII here.
 */

export interface FunnelChartStep {
  /** Human step label, e.g. "Product view". */
  label: string;
  count: number;
}

const CHART_CONFIG = {
  count: { label: "Visitors", color: "var(--chart-1)" },
} satisfies ChartConfig;

/** A warm gradient across the five steps, reusing the chart palette tokens. */
const STEP_COLORS = [
  "var(--chart-1)",
  "var(--chart-5)",
  "var(--chart-4)",
  "var(--chart-2)",
  "var(--chart-3)",
];

export function FunnelChart({ steps }: { steps: FunnelChartStep[] }) {
  return (
    <ChartContainer
      config={CHART_CONFIG}
      className="aspect-auto h-[260px] w-full"
    >
      <BarChart
        data={steps}
        layout="vertical"
        margin={{ left: 4, right: 40, top: 4, bottom: 4 }}
      >
        <XAxis type="number" hide allowDecimals={false} />
        <YAxis
          type="category"
          dataKey="label"
          tickLine={false}
          axisLine={false}
          width={104}
          tickMargin={4}
        />
        <ChartTooltip cursor content={<ChartTooltipContent hideLabel />} />
        <Bar dataKey="count" radius={6} barSize={28} isAnimationActive={false}>
          {steps.map((step, i) => (
            <Cell key={step.label} fill={STEP_COLORS[i % STEP_COLORS.length]} />
          ))}
          <LabelList
            dataKey="count"
            position="right"
            className="fill-foreground text-xs font-medium tabular-nums"
            formatter={(value: number) => value.toLocaleString("en-IN")}
          />
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}
