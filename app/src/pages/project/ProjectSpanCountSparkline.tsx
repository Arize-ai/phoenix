import { useMemo } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";
import { useParams } from "react-router";
import type { TooltipContentProps } from "recharts";
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Text } from "@phoenix/components";
import {
  ChartTooltip,
  ChartTooltipItem,
  defaultXAxisProps,
  defaultYAxisProps,
  useBinTimeTickFormatter,
  useSemanticChartColors,
  useSequentialChartColors,
} from "@phoenix/components/chart";
import { useBinInterval } from "@phoenix/components/chart/useBinInterval";
import { useTimeRange } from "@phoenix/components/datetime";
import { useTimeBinScale } from "@phoenix/hooks/useTimeBin";
import { useTimeFormatters } from "@phoenix/hooks/useTimeFormatters";
import { useUTCOffsetMinutes } from "@phoenix/hooks/useUTCOffsetMinutes";
import { intFormatter } from "@phoenix/utils/numberFormatUtils";

import type { ProjectSpanCountSparklineQuery } from "./__generated__/ProjectSpanCountSparklineQuery.graphql";

const AXIS_FONT_SIZE = 10;
const SPARKLINE_AXIS_STYLE = {
  fill: "var(--chart-axis-text-color)",
  fontSize: AXIS_FONT_SIZE,
};

function TooltipContent({ active, payload, label }: TooltipContentProps) {
  const { fullTimeFormatter } = useTimeFormatters();
  if (!active || !payload || !payload.length) return null;
  const errorValue = payload[0]?.value ?? null;
  const errorColor = payload[0]?.color ?? null;
  const okValue = payload[1]?.value ?? null;
  const okColor = payload[1]?.color ?? null;
  return (
    <ChartTooltip>
      {label != null && (
        <Text weight="heavy" size="S">
          {fullTimeFormatter(new Date(String(label)))}
        </Text>
      )}
      <ChartTooltipItem
        color={errorColor ?? "transparent"}
        shape="circle"
        name="error"
        value={intFormatter(Number(errorValue))}
      />
      <ChartTooltipItem
        color={okColor ?? "transparent"}
        shape="circle"
        name="ok"
        value={intFormatter(Number(okValue))}
      />
    </ChartTooltip>
  );
}

export function ProjectSpanCountSparkline() {
  const { projectId } = useParams();
  const { timeRange } = useTimeRange();
  const scale = useTimeBinScale({ timeRange });
  const utcOffsetMinutes = useUTCOffsetMinutes();

  const data = useLazyLoadQuery<ProjectSpanCountSparklineQuery>(
    graphql`
      query ProjectSpanCountSparklineQuery(
        $projectId: ID!
        $timeRange: TimeRange!
        $timeBinConfig: TimeBinConfig!
      ) {
        project: node(id: $projectId) {
          ... on Project {
            traceCountByStatusTimeSeries(
              timeRange: $timeRange
              timeBinConfig: $timeBinConfig
            ) {
              data {
                timestamp
                okCount
                errorCount
              }
            }
          }
        }
      }
    `,
    {
      projectId: projectId as string,
      timeRange: {
        start: timeRange.start?.toISOString(),
        end: timeRange.end?.toISOString(),
      },
      timeBinConfig: {
        scale,
        utcOffsetMinutes,
      },
    },
    { fetchPolicy: "store-and-network" }
  );

  const chartData = useMemo(
    () =>
      (data.project.traceCountByStatusTimeSeries?.data ?? []).map((datum) => ({
        timestamp: new Date(datum.timestamp),
        ok: datum.okCount,
        error: datum.errorCount,
      })),
    [data.project.traceCountByStatusTimeSeries?.data]
  );

  const timeTickFormatter = useBinTimeTickFormatter({ scale });
  const interval = useBinInterval({ scale });
  const colors = useSequentialChartColors();
  const semanticColors = useSemanticChartColors();

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={chartData}
        margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
        barSize={6}
      >
        <XAxis
          {...defaultXAxisProps}
          dataKey="timestamp"
          interval={interval}
          tickFormatter={(x) => timeTickFormatter(new Date(x))}
          tickLine={false}
          axisLine={false}
          tickMargin={2}
          height={16}
          style={SPARKLINE_AXIS_STYLE}
        />
        <YAxis
          {...defaultYAxisProps}
          tickFormatter={(x) => intFormatter(x)}
          tickLine={false}
          axisLine={false}
          width={24}
          tickCount={3}
          style={SPARKLINE_AXIS_STYLE}
        />
        <Tooltip
          content={TooltipContent}
          cursor={{ fill: "var(--chart-tooltip-cursor-fill-color)" }}
        />
        <Bar dataKey="error" stackId="a" fill={semanticColors.danger} />
        <Bar
          dataKey="ok"
          stackId="a"
          fill={colors.gray300}
          radius={[2, 2, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
