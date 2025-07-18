import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
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
  defaultCartesianGridProps,
  defaultXAxisProps,
  defaultYAxisProps,
  useChartColors,
  useSemanticChartColors,
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
    ok: 100,
    error: 10,
  },
  {
    timestamp: "2021-01-02",
    ok: 100,
    error: 10,
  },
  {
    timestamp: "2021-01-03",
    ok: 100,
    error: 10,
  },
  {
    timestamp: "2021-01-04",
    ok: 100,
    error: 10,
  },
  {
    timestamp: "2021-01-05",
    ok: 100,
    error: 10,
  },
  {
    timestamp: "2021-01-06",
    ok: 100,
    error: 10,
  },
  {
    timestamp: "2021-01-07",
    ok: 100,
    error: 10,
  },
  {
    timestamp: "2021-01-08",
    ok: 100,
    error: 10,
  },
  {
    timestamp: "2021-01-09",
    ok: 100,
    error: 10,
  },
  {
    timestamp: "2021-01-10",
    ok: 100,
    error: 10,
  },
  {
    timestamp: "2021-01-11",
    ok: 100,
    error: 10,
  },
];

function TooltipContent({
  active,
  payload,
  label,
}: TooltipContentProps<number, string>) {
  const SemanticChartColors = useSemanticChartColors();
  const chartColors = useChartColors();
  if (active && payload && payload.length) {
    const okValue = payload[0]?.value ?? null;
    const errorValue = payload[1]?.value ?? null;
    const okString =
      typeof okValue === "number" ? numberFormatter.format(okValue) : "--";
    const errorString =
      typeof errorValue === "number"
        ? numberFormatter.format(errorValue)
        : "--";
    return (
      <ChartTooltip>
        {label && (
          <Text weight="heavy" size="S">{`${fullTimeFormatter(
            new Date(label)
          )}`}</Text>
        )}
        <ChartTooltipItem
          color={SemanticChartColors.danger}
          shape="circle"
          name="error"
          value={errorString}
        />
        <ChartTooltipItem
          color={chartColors.default}
          shape="circle"
          name="ok"
          value={okString}
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
  const SemanticChartColors = useSemanticChartColors();
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={chartData}
        margin={{ top: 0, right: 18, left: 0, bottom: 0 }}
        barSize={10}
      >
        <XAxis
          {...defaultXAxisProps}
          dataKey="timestamp"
          tickFormatter={(x) => timeTickFormatter(new Date(x))}
        />
        <YAxis
          {...defaultYAxisProps}
          width={50}
          label={{
            value: "Count",
            angle: -90,
            dx: -10,
            style: {
              textAnchor: "middle",
              fill: "var(--chart-axis-label-color)",
            },
          }}
        />
        <CartesianGrid {...defaultCartesianGridProps} vertical={false} />
        <Tooltip
          content={TooltipContent}
          // TODO formalize this
          cursor={{ fill: "var(--chart-tooltip-cursor-fill-color)" }}
        />
        <Bar dataKey="error" stackId="a" fill={SemanticChartColors.danger} />
        <Bar
          dataKey="ok"
          stackId="a"
          fill={colors.default}
          radius={[2, 2, 0, 0]}
        />

        <Legend align="left" iconType="circle" iconSize={8} />
      </BarChart>
    </ResponsiveContainer>
  );
}
