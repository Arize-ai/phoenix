import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  TooltipContentProps,
  XAxis,
  YAxis,
} from "recharts";

import { Text } from "@phoenix/components";
import {
  ChartTooltip,
  ChartTooltipItem,
  defaultBarChartTooltipProps,
  defaultCartesianGridProps,
  defaultXAxisProps,
  defaultYAxisProps,
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
  }: TooltipContentProps<number, string>) => {
    if (!active || !payload || !payload.length) return null;

    const data = payload[0];
    const value = data.value;

    return (
      <ChartTooltip>
        {label && (
          <Text weight="heavy" size="S">{`${fullTimeFormatter(
            new Date(label)
          )}`}</Text>
        )}
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
          {...defaultXAxisProps}
          dataKey="timestamp"
          tickFormatter={(timestamp) => timeTickFormatter(new Date(timestamp))}
          textAnchor="middle"
        />

        <YAxis
          {...defaultYAxisProps}
          label={{
            value: "Trace Count",
            angle: -90,
            position: "insideLeft",
            style: {
              textAnchor: "middle",
              fill: "var(--chart-axis-label-color)",
            },
          }}
        />

        <CartesianGrid {...defaultCartesianGridProps} />

        <Tooltip {...defaultBarChartTooltipProps} content={TooltipContent} />

        <Bar dataKey="value" fill={`url(#${barGradientId})`} />
      </BarChart>
    </ResponsiveContainer>
  );
}
