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
  defaultCartesianGridProps,
  defaultLegendProps,
  defaultXAxisProps,
  defaultYAxisProps,
  useSemanticChartColors,
  useTimeTickFormatter,
} from "@phoenix/components/chart";
import { useTimeRange } from "@phoenix/components/datetime";
import { useTimeBinScale } from "@phoenix/hooks/useTimeBin";
import { useUTCOffsetMinutes } from "@phoenix/hooks/useUTCOffsetMinutes";
import { intFormatter } from "@phoenix/utils/numberFormatUtils";
import { fullTimeFormatter } from "@phoenix/utils/timeFormatUtils";

import type { LLMSpanErrorsTimeSeriesQuery } from "./__generated__/LLMSpanErrorsTimeSeriesQuery.graphql";

function TooltipContent({
  active,
  payload,
  label,
}: TooltipContentProps<number, string>) {
  const SemanticChartColors = useSemanticChartColors();
  if (active && payload && payload.length) {
    const errorValue = payload[0]?.value ?? null;
    const errorString = intFormatter(errorValue);
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

export function LLMSpanErrorsTimeSeries({ projectId }: { projectId: string }) {
  const { timeRange } = useTimeRange();
  const scale = useTimeBinScale({ timeRange });
  const utcOffsetMinutes = useUTCOffsetMinutes();

  const data = useLazyLoadQuery<LLMSpanErrorsTimeSeriesQuery>(
    graphql`
      query LLMSpanErrorsTimeSeriesQuery(
        $projectId: ID!
        $timeRange: TimeRange!
        $timeBinConfig: TimeBinConfig!
        $filterCondition: String!
      ) {
        project: node(id: $projectId) {
          ... on Project {
            spanCountTimeSeries(
              timeRange: $timeRange
              timeBinConfig: $timeBinConfig
              filterCondition: $filterCondition
            ) {
              data {
                timestamp
                errorCount
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
      filterCondition: 'span_kind == "LLM"',
    }
  );

  const chartData = (data.project.spanCountTimeSeries?.data ?? []).map(
    (datum) => ({
      timestamp: datum.timestamp,
      error: datum.errorCount,
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
        <Bar
          dataKey="error"
          stackId="a"
          fill={SemanticChartColors.danger}
          radius={[2, 2, 0, 0]}
        />

        <Legend
          {...defaultLegendProps}
          align="left"
          iconType="circle"
          iconSize={8}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
