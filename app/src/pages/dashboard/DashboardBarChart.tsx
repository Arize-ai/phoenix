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

import {
  ChartTooltip,
  ChartTooltipItem,
  defaultBarChartTooltipProps,
  useChartColors,
} from "@phoenix/components/chart";
import { useBinTimeTickFormatter } from "@phoenix/components/chart/useBinTimeTickFormatter";

import type { TimeBinScale } from "./__generated__/TraceCountDashboardBarChartQuery.graphql";

type DashboardBarChartProps = {
  data: { timestamp: string; value: number | null }[];
  scale: TimeBinScale;
};

// Format timestamp based on scale
const formatTimestamp = (timestamp: string, scale: TimeBinScale): string => {
  const date = new Date(timestamp);

  switch (scale) {
    case "YEAR":
      return date.getFullYear().toString();
    case "MONTH":
      return date.toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
      });
    case "WEEK":
    case "DAY":
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
    case "HOUR":
      return date.toLocaleTimeString("en-US", {
        hour: "2-digit",
      });
    case "MINUTE":
      return date.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      });
    default: {
      // This should never happen due to TypeScript's exhaustiveness checking
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const _exhaustiveCheck: never = scale;
      return timestamp;
    }
  }
};

// Helper function to determine if labels should be angled
const shouldAngleLabels = (scale: TimeBinScale): boolean => {
  return scale === "HOUR" || scale === "MINUTE";
};

export function DashboardBarChart({ data, scale }: DashboardBarChartProps) {
  const colors = useChartColors();
  const angleLabels = shouldAngleLabels(scale);

  // Custom tooltip content - defined inside component to access scale
  const TooltipContent = ({
    active,
    payload,
    label,
  }: TooltipProps<number, string>) => {
    if (!active || !payload || !payload.length) return null;

    const data = payload[0];
    const value = data.value;
    const timestamp = label;

    return (
      <ChartTooltip>
        <ChartTooltipItem
          color={barColor}
          name="Time"
          value={formatTimestamp(timestamp, scale)}
        />
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
          bottom: angleLabels ? 60 : 50,
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
          angle={angleLabels ? -45 : 0}
          textAnchor={angleLabels ? "end" : "middle"}
          height={angleLabels ? 60 : 50}
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
