import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  TooltipProps,
  XAxis,
  YAxis,
} from "recharts";

import { Text } from "@phoenix/components";
import {
  ChartTooltip,
  ChartTooltipItem,
  defaultBarChartTooltipProps,
  useChartColors,
} from "@phoenix/components/chart";
import { useBinTimeTickFormatter } from "@phoenix/components/chart/useBinTimeTickFormatter";
import { fullTimeFormatter } from "@phoenix/utils/timeFormatUtils";

import type { TimeBinScale } from "./__generated__/TraceCountDashboardBarChartQuery.graphql";

type DashboardBarChartProps = {
  data: { timestamp: string; value: number | null }[];
  scale: TimeBinScale;
};

export function DashboardBarChart({ data, scale }: DashboardBarChartProps) {
  const colors = useChartColors();

  // Custom tooltip content - defined inside component to access scale
  const TooltipContent = ({
    active,
    payload,
    label,
  }: TooltipProps<number, string>) => {
    if (!active || !payload || !payload.length) return null;

    const data = payload[0];
    const value = data.value;

    return (
      <ChartTooltip>
        <Text weight="heavy" size="S">{`${fullTimeFormatter(
          new Date(label)
        )}`}</Text>
        <ChartTooltipItem
          color={barColor}
          name="Traces"
          value={typeof value === "number" ? value.toLocaleString() : "--"}
        />
      </ChartTooltip>
    );
  };

  // Use theme-appropriate colors following existing patterns
  const barColor = colors.blue400;
  const barGradientId = "dashboardBarGradient";

  const timeTickFormatter = useBinTimeTickFormatter({ scale });

  return (
    <ResponsiveContainer>
      <BarChart
        data={data}
        margin={{
          top: 25,
          right: 18,
          left: 18,
          bottom: 50,
        }}
      >
        <defs>
          <linearGradient id={barGradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={barColor} stopOpacity={1} />
            <stop offset="95%" stopColor={barColor} stopOpacity={0.5} />
          </linearGradient>
        </defs>

        <XAxis
          dataKey="timestamp"
          tickFormatter={(timestamp) => timeTickFormatter(new Date(timestamp))}
          style={{ fill: "var(--ac-global-text-color-700)" }}
          textAnchor="middle"
        />

        <YAxis
          stroke="var(--ac-global-color-grey-500)"
          label={{
            value: "Trace Count",
            angle: -90,
            position: "insideLeft",
            style: {
              textAnchor: "middle",
              fill: "var(--ac-global-text-color-900)",
            },
          }}
          style={{ fill: "var(--ac-global-text-color-700)" }}
        />

        <CartesianGrid
          strokeDasharray="4 4"
          stroke="var(--ac-global-color-grey-500)"
          strokeOpacity={0.5}
        />

        <Tooltip
          {...defaultBarChartTooltipProps}
          content={<TooltipContent />}
        />

        <Bar dataKey="value" fill={`url(#${barGradientId})`} />
      </BarChart>
    </ResponsiveContainer>
  );
}
