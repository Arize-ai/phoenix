import { graphql, useLazyLoadQuery } from "react-relay";
import type { TooltipContentProps } from "recharts";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Text } from "@phoenix/components";
import {
  ChartEmptyStateOverlay,
  ChartTooltip,
  ChartTooltipItem,
  InteractiveLegend,
  TimeRangeChartBrush,
  defaultCartesianGridProps,
  defaultLegendProps,
  defaultTimeXAxisProps,
  defaultYAxisProps,
  useBinTimeTickFormatter,
  useInteractiveLegend,
  useSemanticChartColors,
} from "@phoenix/components/chart";
import { useTimeBinScale } from "@phoenix/hooks/useTimeBin";
import { useTimeFormatters } from "@phoenix/hooks/useTimeFormatters";
import { useUTCOffsetMinutes } from "@phoenix/hooks/useUTCOffsetMinutes";
import type { ProjectMetricViewProps } from "@phoenix/pages/project/metrics/types";
import {
  intFormatter,
  intShortFormatter,
} from "@phoenix/utils/numberFormatUtils";

import type { LLMSpanErrorsTimeSeriesQuery } from "./__generated__/LLMSpanErrorsTimeSeriesQuery.graphql";

function TooltipContent({ active, payload, label }: TooltipContentProps) {
  const SemanticChartColors = useSemanticChartColors();
  const { fullTimeFormatter } = useTimeFormatters();
  if (active && payload && payload.length) {
    const errorValue = payload[0]?.value ?? null;
    const errorString = intFormatter(Number(errorValue));
    return (
      <ChartTooltip>
        {label && (
          <Text weight="heavy" size="S">{`${fullTimeFormatter(
            new Date(Number(label))
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

export function LLMSpanErrorsTimeSeries({
  projectId,
  timeRange,
  onTimeRangeSelected,
}: ProjectMetricViewProps) {
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
                totalCount
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
      timestamp: new Date(datum.timestamp).getTime(),
      error: datum.errorCount,
      total: datum.totalCount ?? 0,
    })
  );
  const hasData = chartData.some((datum) => datum.total > 0);

  const timeTickFormatter = useBinTimeTickFormatter({ scale });

  const SemanticChartColors = useSemanticChartColors();
  const { hiddenDataKeys, isDataKeyHidden, toggleDataKey } =
    useInteractiveLegend();
  return (
    <TimeRangeChartBrush onTimeRangeSelected={onTimeRangeSelected}>
      {({ chartProps }) => (
        <ChartEmptyStateOverlay
          isEmpty={!hasData}
          message="No data in this time range"
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 0, right: 18, left: 8, bottom: 0 }}
              barSize={10}
              syncId={"projectMetrics"}
              {...chartProps}
            >
              <XAxis
                {...defaultTimeXAxisProps}
                domain={[timeRange.start.getTime(), timeRange.end.getTime()]}
                tickFormatter={(x) => timeTickFormatter(new Date(x))}
              />
              <YAxis
                {...defaultYAxisProps}
                width={55}
                tickFormatter={(x) => intShortFormatter(x)}
                label={{
                  value: "Count",
                  angle: -90,
                  dx: -28,
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
                hide={isDataKeyHidden("error")}
                radius={[2, 2, 0, 0]}
              />

              <InteractiveLegend
                {...defaultLegendProps}
                hiddenDataKeys={hiddenDataKeys}
                iconType="circle"
                iconSize={8}
                onToggleDataKey={toggleDataKey}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartEmptyStateOverlay>
      )}
    </TimeRangeChartBrush>
  );
}
