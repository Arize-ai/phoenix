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
  useCategoryChartColors,
} from "@phoenix/components/chart";
import { useTimeBinScale } from "@phoenix/hooks/useTimeBin";
import { useTimeFormatters } from "@phoenix/hooks/useTimeFormatters";
import { useUTCOffsetMinutes } from "@phoenix/hooks/useUTCOffsetMinutes";
import { ProjectMetricViewProps } from "@phoenix/pages/project/metrics/types";
import {
  costFormatter,
  floatShortFormatter,
} from "@phoenix/utils/numberFormatUtils";

import { TraceTokenCostTimeSeriesQuery } from "./__generated__/TraceTokenCostTimeSeriesQuery.graphql";

function TooltipContent({
  active,
  payload,
  label,
}: TooltipContentProps<number, string>) {
  const chartColors = useCategoryChartColors();
  const { fullTimeFormatter } = useTimeFormatters();
  if (active && payload && payload.length) {
    const promptValue = payload[0]?.value;
    const completionValue = payload[1]?.value;
    const promptString = costFormatter(promptValue);
    const completionString = costFormatter(completionValue);
    return (
      <ChartTooltip>
        {label && (
          <Text weight="heavy" size="S">{`${fullTimeFormatter(
            new Date(label)
          )}`}</Text>
        )}
        <ChartTooltipItem
          color={chartColors.category1}
          shape="circle"
          name="prompt"
          value={promptString}
        />
        <ChartTooltipItem
          color={chartColors.category2}
          shape="circle"
          name="completion"
          value={completionString}
        />
      </ChartTooltip>
    );
  }

  return null;
}

export function TraceTokenCostTimeSeries({
  projectId,
  timeRange,
}: ProjectMetricViewProps) {
  const scale = useTimeBinScale({ timeRange });
  const utcOffsetMinutes = useUTCOffsetMinutes();

  const data = useLazyLoadQuery<TraceTokenCostTimeSeriesQuery>(
    graphql`
      query TraceTokenCostTimeSeriesQuery(
        $projectId: ID!
        $timeRange: TimeRange!
        $timeBinConfig: TimeBinConfig!
      ) {
        project: node(id: $projectId) {
          ... on Project {
            traceTokenCostTimeSeries(
              timeRange: $timeRange
              timeBinConfig: $timeBinConfig
            ) {
              data {
                timestamp
                promptCost
                completionCost
                totalCost
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

  const chartData = (data.project.traceTokenCostTimeSeries?.data ?? []).map(
    (datum: {
      timestamp: string;
      promptCost: number | null;
      completionCost: number | null;
    }) => ({
      timestamp: datum.timestamp,
      prompt: datum.promptCost,
      completion: datum.completionCost,
    })
  );

  const timeTickFormatter = useBinTimeTickFormatter({ scale });
  const interval = useBinInterval({ scale });

  const colors = useCategoryChartColors();
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={chartData}
        margin={{ top: 0, right: 18, left: 0, bottom: 0 }}
        barSize={10}
        syncId={"projectMetrics"}
      >
        <CartesianGrid {...defaultCartesianGridProps} vertical={false} />
        <XAxis
          {...defaultXAxisProps}
          dataKey="timestamp"
          interval={interval}
          tickFormatter={(x) => timeTickFormatter(new Date(x))}
        />
        <YAxis
          {...defaultYAxisProps}
          width={55}
          tickFormatter={(x) => floatShortFormatter(x)}
          label={{
            value: "Cost (USD)",
            angle: -90,
            dx: -20,
            style: {
              textAnchor: "middle",
              fill: "var(--chart-axis-label-color)",
            },
          }}
        />
        <Tooltip
          content={TooltipContent}
          // TODO formalize this
          cursor={{ fill: "var(--chart-tooltip-cursor-fill-color)" }}
        />
        <Bar dataKey="prompt" stackId="a" fill={colors.category1} />
        <Bar
          dataKey="completion"
          stackId="a"
          fill={colors.category2}
          radius={[2, 2, 0, 0]}
        />

        <Legend {...defaultLegendProps} iconType="circle" iconSize={8} />
      </BarChart>
    </ResponsiveContainer>
  );
}
