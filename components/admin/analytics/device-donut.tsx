"use client";

import { useMemo } from "react";
import { Cell, Label, Pie, PieChart } from "recharts";

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

/**
 * Device-split donut (docs/13 FR-24) — a small **client leaf** fed the
 * already-aggregated session-by-device shares from the RSC page. Donut with the
 * total session count in the centre. Theme palette via `--color-*`; the legend
 * carries the labels so meaning is never colour-only (a11y).
 *
 * Buckets are non-identifying device classes; no fetch, no PII.
 */

export interface DeviceDatum {
  /** Device bucket key (mobile/tablet/desktop/bot). */
  device: string;
  /** Display label, e.g. "Mobile". */
  label: string;
  count: number;
}

const DEVICE_COLOR: Record<string, string> = {
  mobile: "var(--chart-1)",
  tablet: "var(--chart-4)",
  desktop: "var(--chart-5)",
  bot: "var(--chart-3)",
};

export function DeviceDonut({ data }: { data: DeviceDatum[] }) {
  const total = useMemo(
    () => data.reduce((sum, d) => sum + d.count, 0),
    [data],
  );

  // Build the chart config (label + color per device) so tooltip/legend resolve.
  const config = useMemo<ChartConfig>(() => {
    const c: ChartConfig = { count: { label: "Sessions" } };
    for (const d of data) {
      c[d.device] = {
        label: d.label,
        color: DEVICE_COLOR[d.device] ?? "var(--chart-2)",
      };
    }
    return c;
  }, [data]);

  return (
    <ChartContainer
      config={config}
      className="mx-auto aspect-square h-[220px] w-full max-w-[260px]"
    >
      <PieChart>
        <ChartTooltip cursor content={<ChartTooltipContent nameKey="device" hideLabel />} />
        <Pie
          data={data}
          dataKey="count"
          nameKey="device"
          innerRadius={56}
          outerRadius={84}
          strokeWidth={2}
          isAnimationActive={false}
        >
          {data.map((d) => (
            <Cell key={d.device} fill={DEVICE_COLOR[d.device] ?? "var(--chart-2)"} />
          ))}
          <Label
            content={({ viewBox }) => {
              if (!viewBox || !("cx" in viewBox) || !("cy" in viewBox)) return null;
              return (
                <text
                  x={viewBox.cx}
                  y={viewBox.cy}
                  textAnchor="middle"
                  dominantBaseline="middle"
                >
                  <tspan
                    x={viewBox.cx}
                    y={viewBox.cy}
                    className="fill-foreground text-xl font-bold tabular-nums"
                  >
                    {total.toLocaleString("en-IN")}
                  </tspan>
                  <tspan
                    x={viewBox.cx}
                    y={(viewBox.cy ?? 0) + 18}
                    className="fill-muted-foreground text-xs"
                  >
                    sessions
                  </tspan>
                </text>
              );
            }}
          />
        </Pie>
        <ChartLegend content={<ChartLegendContent nameKey="device" className="flex-wrap" />} />
      </PieChart>
    </ChartContainer>
  );
}
