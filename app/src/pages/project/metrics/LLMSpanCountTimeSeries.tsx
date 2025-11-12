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
  useBinInterval,
  useBinTimeTickFormatter,
  useSemanticChartColors,
  useSequentialChartColors,
} from "@phoenix/components/chart";
import { useTimeBinScale } from "@phoenix/hooks/useTimeBin";
import { useTimeFormatters } from "@phoenix/hooks/useTimeFormatters";
import { useUTCOffsetMinutes } from "@phoenix/hooks/useUTCOffsetMinutes";
import { ProjectMetricViewProps } from "@phoenix/pages/project/metrics/types";
import {
  intFormatter,
  intShortFormatter,
} from "@phoenix/utils/numberFormatUtils";

import type { LLMSpanCountTimeSeriesQuery } from "./__generated__/LLMSpanCountTimeSeriesQuery.graphql";

function TooltipContent({
  active,
  payload,
  label,
}: TooltipContentProps<number, string>) {
  const { fullTimeFormatter } = useTimeFormatters();
  if (active && payload && payload.length) {
    const errorValue = payload[0]?.value ?? null;
    const errorColor = payload[0]?.color ?? null;
    const unsetValue = payload[1]?.value ?? null;
    const unsetColor = payload[1]?.color ?? null;
    const okValue = payload[2]?.value ?? null;
    const okColor = payload[2]?.color ?? null;
    const okString = intFormatter(okValue);
    const unsetString = intFormatter(unsetValue);
    const errorString = intFormatter(errorValue);
    return (
      <ChartTooltip>
        {label && (
          <Text weight="heavy" size="S">{`${fullTimeFormatter(
            new Date(label)
          )}`}</Text>
        )}
        <ChartTooltipItem
          color={errorColor}
          shape="circle"
          name="error"
          value={errorString}
        />
        <ChartTooltipItem
          color={unsetColor}
          shape="circle"
          name="unset"
          value={unsetString}
        />
        <ChartTooltipItem
          color={okColor}
          shape="circle"
          name="ok"
          value={okString}
        />
      </ChartTooltip>
    );
  }

  return null;
}

export function LLMSpanCountTimeSeries({
  projectId,
  timeRange,
}: ProjectMetricViewProps) {
  const scale = useTimeBinScale({ timeRange });
  const utcOffsetMinutes = useUTCOffsetMinutes();

  const data = useLazyLoadQuery<LLMSpanCountTimeSeriesQuery>(
    graphql`
      query LLMSpanCountTimeSeriesQuery(
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
                okCount
                errorCount
                unsetCount
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
      unset: datum.unsetCount,
      ok: datum.okCount,
    })
  );

  const timeTickFormatter = useBinTimeTickFormatter({ scale });

  const colors = useSequentialChartColors();
  const SemanticChartColors = useSemanticChartColors();
  const interval = useBinInterval({ scale });
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={chartData}
        margin={{ top: 0, right: 18, left: 0, bottom: 0 }}
        barSize={10}
        syncId={"projectMetrics"}
      >
        <XAxis
          {...defaultXAxisProps}
          dataKey="timestamp"
          interval={interval}
          tickFormatter={(x) => timeTickFormatter(new Date(x))}
        />
        <YAxis
          {...defaultYAxisProps}
          width={55}
          tickFormatter={(x) => intShortFormatter(x)}
          label={{
            value: "Count",
            angle: -90,
            dx: -20,
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
        <Bar dataKey="unset" stackId="a" fill={colors.grey500} />
        <Bar
          dataKey="ok"
          stackId="a"
          fill={colors.grey300}
          radius={[2, 2, 0, 0]}
        />
        <Legend {...defaultLegendProps} iconType="circle" iconSize={8} />
      </BarChart>
    </ResponsiveContainer>
  );
}
