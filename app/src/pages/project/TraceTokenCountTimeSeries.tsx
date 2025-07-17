import { graphql, useLazyLoadQuery } from "react-relay";
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
  useChartColors,
  useSemanticChartColors,
  useTimeTickFormatter,
} from "@phoenix/components/chart";
import { useTimeRange } from "@phoenix/components/datetime";
import { useTimeBinScale } from "@phoenix/hooks/useTimeBin";
import { useUTCOffsetMinutes } from "@phoenix/hooks/useUTCOffsetMinutes";
import { intFormatter } from "@phoenix/utils/numberFormatUtils";
import { fullTimeFormatter } from "@phoenix/utils/timeFormatUtils";

import type { TraceTokenCountTimeSeriesQuery } from "./__generated__/TraceTokenCountTimeSeriesQuery.graphql";

function TooltipContent({
  active,
  payload,
  label,
}: TooltipContentProps<number, string>) {
  const SemanticChartColors = useSemanticChartColors();
  const chartColors = useChartColors();
  if (active && payload && payload.length) {
    // For stacked bar charts, payload[0] is the first bar (prompt), payload[1] is the second bar (completion)
    const promptValue = payload[0]?.value ?? null;
    const completionValue = payload[1]?.value ?? null;
    const promptString =
      typeof promptValue === "number" ? intFormatter(promptValue) : "--";
    const completionString =
      typeof completionValue === "number"
        ? intFormatter(completionValue)
        : "--";
    return (
      <ChartTooltip>
        {label && (
          <Text weight="heavy" size="S">{`${fullTimeFormatter(
            new Date(label)
          )}`}</Text>
        )}
        <ChartTooltipItem
          color={SemanticChartColors.info}
          shape="circle"
          name="prompt"
          value={promptString}
        />
        <ChartTooltipItem
          color={chartColors.default}
          shape="circle"
          name="completion"
          value={completionString}
        />
      </ChartTooltip>
    );
  }

  return null;
}

export function TraceTokenCountTimeSeries({
  projectId,
}: {
  projectId: string;
}) {
  const { timeRange } = useTimeRange();
  const scale = useTimeBinScale({ timeRange });
  const utcOffsetMinutes = useUTCOffsetMinutes();

  const data = useLazyLoadQuery<TraceTokenCountTimeSeriesQuery>(
    graphql`
      query TraceTokenCountTimeSeriesQuery(
        $projectId: ID!
        $timeRange: TimeRange!
        $timeBinConfig: TimeBinConfig!
      ) {
        project: node(id: $projectId) {
          ... on Project {
            traceTokenCountTimeSeries(
              timeRange: $timeRange
              timeBinConfig: $timeBinConfig
            ) {
              data {
                timestamp
                promptTokenCount
                completionTokenCount
                totalTokenCount
              }
            }
          }
        }
      }
    `,
    {
      projectId,
      timeRange: {
        start: timeRange.start?.toISOString(),
        end: timeRange.end?.toISOString(),
      },
      timeBinConfig: {
        scale,
        utcOffsetMinutes,
      },
    }
  );

  const chartData = (data.project.traceTokenCountTimeSeries?.data ?? []).map(
    (datum) => ({
      timestamp: datum.timestamp,
      prompt: datum.promptTokenCount ?? 0,
      completion: datum.completionTokenCount ?? 0,
    })
  );

  const timeTickFormatter = useTimeTickFormatter({
    samplingIntervalMinutes: (() => {
      switch (scale) {
        case "MINUTE":
          return 1;
        case "HOUR":
          return 60;
        default:
          return 60 * 24;
      }
    })(),
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
          dataKey="timestamp"
          tickFormatter={(x) => timeTickFormatter(new Date(x))}
          style={{ fill: "var(--ac-global-text-color-700)" }}
          stroke="var(--ac-global-color-grey-400)"
        />
        <YAxis
          stroke="var(--ac-global-color-grey-500)"
          width={50}
          label={{
            value: "Tokens",
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
        <Bar dataKey="prompt" stackId="a" fill={SemanticChartColors.info} />
        <Bar
          dataKey="completion"
          stackId="a"
          fill={colors.default}
          radius={[2, 2, 0, 0]}
        />

        <Legend align="left" iconType="circle" iconSize={8} />
      </BarChart>
    </ResponsiveContainer>
  );
}
