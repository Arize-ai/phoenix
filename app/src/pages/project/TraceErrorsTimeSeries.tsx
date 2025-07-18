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
    error: 0,
  },
  {
    timestamp: "2021-01-02",
    error: 0,
  },
  {
    timestamp: "2021-01-03",
    error: 0,
  },
  {
    timestamp: "2021-01-04",
    error: 10,
  },
  {
    timestamp: "2021-01-05",
    error: 30,
  },
  {
    timestamp: "2021-01-06",
    error: 0,
  },
  {
    timestamp: "2021-01-07",
    error: 40,
  },
  {
    timestamp: "2021-01-08",
    error: 0,
  },
  {
    timestamp: "2021-01-09",
    error: 10,
  },
  {
    timestamp: "2021-01-10",
    error: 0,
  },
  {
    timestamp: "2021-01-11",
    error: 0,
  },
];

function TooltipContent({
  active,
  payload,
  label,
}: TooltipContentProps<number, string>) {
  const SemanticChartColors = useSemanticChartColors();
  if (active && payload && payload.length) {
    const errorValue = payload[0]?.value ?? null;
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
      </ChartTooltip>
    );
  }

  return null;
}

export function TraceErrorsTimeSeries() {
  const timeRange = {
    start: new Date("2021-01-01"),
    end: new Date("2021-01-11"),
  };

  const granularity = calculateGranularity(timeRange);
  const timeTickFormatter = useTimeTickFormatter({
    samplingIntervalMinutes: granularity.samplingIntervalMinutes,
  });

  const SemanticChartColors = useSemanticChartColors();
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={chartData}
        margin={{ top: 0, right: 18, left: 0, bottom: 0 }}
        barSize={10}
      >
        <XAxis
          dataKey="timestamp"
          tickFormatter={(x) => timeTickFormatter(new Date(x))}
          style={{ fill: "var(--ac-global-text-color-700)" }}
          stroke="var(--ac-global-color-grey-400)"
        />
        <YAxis
          stroke="var(--ac-global-color-grey-500)"
          width={50}
          label={{
            value: "Count",
            angle: -90,
            dx: -10,
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
        <Tooltip
          content={TooltipContent}
          // TODO formalize this
          cursor={{ fill: "var(--chart-tooltip-cursor-fill-color)" }}
        />
        <Bar
          dataKey="error"
          stackId="a"
          fill={SemanticChartColors.danger}
          radius={[2, 2, 0, 0]}
        />

        <Legend align="left" iconType="circle" iconSize={8} />
      </BarChart>
    </ResponsiveContainer>
  );
}
