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
  useTimeTickFormatter,
} from "@phoenix/components/chart";
import { fullTimeFormatter } from "@phoenix/utils/timeFormatUtils";
import { calculateGranularity } from "@phoenix/utils/timeSeriesUtils";

type ColorMap = Record<string, string>;

export type TimeSeriesBarChartProps = {
  /**
   * The data to display in the chart, along with a timestamp for each data point
   * @example
   * [
   *   {
   *     timestamp: "2021-01-01",
   *     ok: 100,
   *     error: 10,
   *   },
   *   {
   *     timestamp: "2021-01-02",
   *     ok: 100,
   *     error: 20,
   *   },
   * ]
   */
  data: Array<{
    timestamp: string;
    [key: string]: number | string;
  }>;
  /**
   * The colors to use for each key
   * @example
   * {
   *   ok: "var(--ac-global-color-green-500)",
   *   error: "var(--ac-global-color-red-500)",
   * }
   */
  colorMap: ColorMap;
  /**
   * The keys to display in the chart, ordered from bottom to top
   * @example
   * ["ok", "error"]
   */
  orderedKeys: string[];
  /**
   * The time range to display in the chart
   * @example
   * {
   *   start: new Date("2021-01-01"),
   *   end: new Date("2021-01-11"),
   * }
   */
  timeRange: {
    start: Date;
    end: Date;
  };
};

const numberFormatter = new Intl.NumberFormat([], {
  maximumFractionDigits: 2,
});

function TooltipContent({
  active,
  payload,
  label,
}: TooltipContentProps<number, string>) {
  if (active && payload && payload.length) {
    const items = payload.map((p) => ({
      formattedValue:
        typeof p.value === "number" ? numberFormatter.format(p.value) : "--",
      color: p.color,
      name: p.name,
    }));

    return (
      <ChartTooltip>
        {label && (
          <Text weight="heavy" size="S">{`${fullTimeFormatter(
            new Date(label)
          )}`}</Text>
        )}
        {items.map((item) => (
          <ChartTooltipItem
            key={item.name}
            color={item.color ?? "var(--ac-global-color-grey-500)"}
            shape="circle"
            name={item.name}
            value={item.formattedValue}
          />
        ))}
      </ChartTooltip>
    );
  }

  return null;
}

export function TimeSeriesBarChart({
  data,
  colorMap,
  orderedKeys,
  timeRange,
}: TimeSeriesBarChartProps) {
  const granularity = calculateGranularity(timeRange);
  const timeTickFormatter = useTimeTickFormatter({
    samplingIntervalMinutes: granularity.samplingIntervalMinutes,
  });

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={data}
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
        {orderedKeys.map((key, index) => (
          <Bar
            key={key}
            dataKey={key}
            stackId="a"
            fill={colorMap[key]}
            radius={index === orderedKeys.length - 1 ? [2, 2, 0, 0] : undefined}
          />
        ))}
        <Legend align="left" iconType="circle" iconSize={8} />
      </BarChart>
    </ResponsiveContainer>
  );
}
