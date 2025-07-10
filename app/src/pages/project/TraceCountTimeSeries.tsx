import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
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
  useChartColors,
  useTimeTickFormatter,
} from "@phoenix/components/chart";
import { fullTimeFormatter } from "@phoenix/utils/timeFormatUtils";
import { calculateGranularity } from "@phoenix/utils/timeSeriesUtils";

const numberFormatter = new Intl.NumberFormat([], {
  maximumFractionDigits: 2,
});

const chartData = [
  {
    timestamp: "2021-01-01",
    traceCount: 100,
    errorCount: 10,
  },
  {
    timestamp: "2021-01-02",
    traceCount: 100,
    errorCount: 10,
  },
  {
    timestamp: "2021-01-03",
    traceCount: 100,
    errorCount: 10,
  },
  {
    timestamp: "2021-01-04",
    traceCount: 100,
    errorCount: 10,
  },
  {
    timestamp: "2021-01-05",
    traceCount: 100,
    errorCount: 10,
  },
  {
    timestamp: "2021-01-06",
    traceCount: 100,
    errorCount: 10,
  },
  {
    timestamp: "2021-01-07",
    traceCount: 100,
    errorCount: 10,
  },
  {
    timestamp: "2021-01-08",
    traceCount: 100,
    errorCount: 10,
  },
  {
    timestamp: "2021-01-09",
    traceCount: 100,
    errorCount: 10,
  },
  {
    timestamp: "2021-01-10",
    traceCount: 100,
    errorCount: 10,
  },
  {
    timestamp: "2021-01-11",
    traceCount: 100,
    errorCount: 10,
  },
];

function TooltipContent({
  active,
  payload,
  label,
}: TooltipProps<number, string>) {
  const chartColors = useChartColors();
  if (active && payload && payload.length) {
    const metricValue = payload[1]?.value ?? null;
    const count = payload[0]?.value ?? null;
    const metricString =
      typeof metricValue === "number"
        ? numberFormatter.format(metricValue)
        : "--";
    const predictionCountString =
      typeof count === "number" ? numberFormatter.format(count) : "--";
    return (
      <ChartTooltip>
        <Text weight="heavy" size="S">{`${fullTimeFormatter(
          new Date(label)
        )}`}</Text>
        <ChartTooltipItem
          color={chartColors.red500}
          name={payload[1]?.payload.metricName ?? "Metric"}
          value={metricString}
        />
        <ChartTooltipItem
          color={chartColors.gray500}
          shape="square"
          name="Count"
          value={predictionCountString}
        />
      </ChartTooltip>
    );
  }

  return null;
}

export function TraceCountTimeSeries() {
  const timeRange = {
    start: new Date("2021-01-01"),
    end: new Date("2021-01-11"),
  };

  const granularity = calculateGranularity(timeRange);
  const timeTickFormatter = useTimeTickFormatter({
    samplingIntervalMinutes: granularity.samplingIntervalMinutes,
  });

  const colors = useChartColors();
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={chartData}
        margin={{ top: 25, right: 18, left: 0, bottom: 0 }}
      >
        <XAxis
          //   {...defaultTimeXAxisProps}
          dataKey="timestamp"
          tickFormatter={(x) => timeTickFormatter(new Date(x))}
          style={{ fill: "var(--ac-global-text-color-700)" }}
        />
        <YAxis
          stroke="var(--ac-global-color-grey-500)"
          label={{
            value: "Trace Count",
            angle: -90,
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
          vertical={false}
        />
        <Tooltip content={<TooltipContent />} />
        <Bar dataKey="errorCount" stackId="a" fill={colors.red500} />
        <Bar
          dataKey="traceCount"
          stackId="a"
          fill={colors.gray600}
          radius={[2, 2, 0, 0]}
        />

        <Legend align="left" />
      </BarChart>
    </ResponsiveContainer>
  );
}
