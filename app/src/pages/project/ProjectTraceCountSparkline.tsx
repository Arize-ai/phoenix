import { css } from "@emotion/react";
import { useMemo } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";
import { useParams } from "react-router";
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

import { Skeleton, Text } from "@phoenix/components";
import {
  ChartTooltip,
  ChartTooltipItem,
  TimeRangeChartBrush,
  defaultCartesianGridProps,
  defaultTimeXAxisProps,
  defaultYAxisProps,
  useBinTimeTickFormatter,
  useSemanticChartColors,
  useSequentialChartColors,
} from "@phoenix/components/chart";
import { useTimeRange } from "@phoenix/components/datetime";
import { useStreamState } from "@phoenix/contexts/StreamStateContext";
import { useTimeBinScale } from "@phoenix/hooks/useTimeBin";
import { useTimeFormatters } from "@phoenix/hooks/useTimeFormatters";
import { useUTCOffsetMinutes } from "@phoenix/hooks/useUTCOffsetMinutes";
import { intFormatter } from "@phoenix/utils/numberFormatUtils";

import type { ProjectTraceCountSparklineQuery } from "./__generated__/ProjectTraceCountSparklineQuery.graphql";

const SPARKLINE_AXIS_STYLE = {
  fill: "var(--chart-axis-text-color)",
  fontSize: 10,
};

const SPARKLINE_SKELETON_BARS = [
  { id: "start", height: 8 },
  { id: "low-1", height: 10 },
  { id: "low-2", height: 12 },
  { id: "low-3", height: 9 },
  { id: "peak-1", height: 46 },
  { id: "low-4", height: 11 },
  { id: "peak-2", height: 44 },
  { id: "low-5", height: 12 },
  { id: "peak-3", height: 50 },
];

function getTooltipLabelDate(label: unknown) {
  if (label instanceof Date) {
    return label;
  }
  if (typeof label === "number") {
    return new Date(label);
  }
  const numericLabel = Number(label);
  if (Number.isFinite(numericLabel)) {
    return new Date(numericLabel);
  }
  return new Date(String(label));
}

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
          {fullTimeFormatter(getTooltipLabelDate(label))}
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

export function ProjectTraceCountSparkline() {
  const { projectId } = useParams();
  const { timeRange, setCustomTimeRange } = useTimeRange();
  const { fetchKey } = useStreamState();
  const scale = useTimeBinScale({ timeRange });
  const utcOffsetMinutes = useUTCOffsetMinutes();

  const data = useLazyLoadQuery<ProjectTraceCountSparklineQuery>(
    graphql`
      query ProjectTraceCountSparklineQuery(
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
    { fetchKey, fetchPolicy: "store-and-network" }
  );

  const chartData = useMemo(
    () =>
      (data.project.traceCountByStatusTimeSeries?.data ?? []).map((datum) => ({
        timestamp: new Date(datum.timestamp).getTime(),
        ok: datum.okCount,
        error: datum.errorCount,
      })),
    [data.project.traceCountByStatusTimeSeries?.data]
  );

  const timeTickFormatter = useBinTimeTickFormatter({ scale });
  const colors = useSequentialChartColors();
  const semanticColors = useSemanticChartColors();

  return (
    <div css={sparklineCSS}>
      <TimeRangeChartBrush onTimeRangeSelected={setCustomTimeRange}>
        {({ chartProps }) => (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
              barSize={10}
              {...chartProps}
            >
              <CartesianGrid {...defaultCartesianGridProps} vertical={false} />
              <XAxis
                {...defaultTimeXAxisProps}
                domain={[
                  timeRange.start?.getTime() ?? "dataMin",
                  timeRange.end?.getTime() ?? "dataMax",
                ]}
                tickFormatter={(x) => timeTickFormatter(new Date(x))}
                tickSize={3}
                tickMargin={2}
                height={16}
                style={SPARKLINE_AXIS_STYLE}
              />
              <YAxis
                {...defaultYAxisProps}
                tickFormatter={(x) => intFormatter(x)}
                axisLine={false}
                tickSize={3}
                width={24}
                tickCount={3}
                style={SPARKLINE_AXIS_STYLE}
              />
              <Tooltip
                content={TooltipContent}
                cursor={{ fill: "var(--chart-tooltip-cursor-fill-color)" }}
                allowEscapeViewBox={{ x: true, y: true }}
                wrapperStyle={{ zIndex: 100 }}
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
        )}
      </TimeRangeChartBrush>
    </div>
  );
}

export function ProjectTraceCountSparklineSkeleton() {
  return (
    <div css={sparklineCSS} aria-hidden="true">
      <div css={sparklineSkeletonCSS}>
        <div css={sparklineSkeletonGridCSS}>
          <span />
          <span />
          <span />
        </div>
        <div css={sparklineSkeletonBarsCSS}>
          {SPARKLINE_SKELETON_BARS.map((bar) => (
            <Skeleton
              key={bar.id}
              width={10}
              height={bar.height}
              borderRadius="XS"
              animation="wave"
            />
          ))}
        </div>
      </div>
    </div>
  );
}

const sparklineCSS = css`
  flex: 1 1 auto;
  height: 72px;
  min-width: 0;
  overflow: visible;
  .recharts-responsive-container,
  .recharts-wrapper {
    overflow: visible !important;
  }
`;

const sparklineSkeletonCSS = css`
  position: relative;
  height: 100%;
  width: 100%;
`;

const sparklineSkeletonGridCSS = css`
  position: absolute;
  inset: var(--global-dimension-static-size-50)
    var(--global-dimension-static-size-50)
    var(--global-dimension-static-size-200) 0;
  display: flex;
  flex-direction: column;
  justify-content: space-between;

  span {
    height: 1px;
    border-top: 1px dashed var(--chart-cartesian-grid-stroke-color);
  }
`;

const sparklineSkeletonBarsCSS = css`
  position: absolute;
  inset: var(--global-dimension-static-size-50)
    var(--global-dimension-static-size-50)
    var(--global-dimension-static-size-200)
    var(--global-dimension-static-size-300);
  display: flex;
  align-items: end;
  justify-content: space-between;
`;
