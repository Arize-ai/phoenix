import { css } from "@emotion/react";
import { useMemo, useRef } from "react";
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

import { Text } from "@phoenix/components";
import {
  ChartTooltip,
  ChartTooltipItem,
  SparklineSkeleton,
  TimeRangeChartBrush,
  defaultCartesianGridProps,
  defaultChartTooltipWrapperStyle,
  defaultTimeXAxisProps,
  useTimeAxisTicks,
  useBinTimeTickFormatter,
  useSemanticChartColors,
  useSequentialChartColors,
} from "@phoenix/components/chart";
import { useTimeRange } from "@phoenix/components/datetime";
import { ONE_MONTH_MS } from "@phoenix/constants/timeConstants";
import { useStreamState } from "@phoenix/contexts/StreamStateContext";
import { useDimensions } from "@phoenix/hooks/useDimensions";
import { useTimeBinScale } from "@phoenix/hooks/useTimeBin";
import { useTimeFormatters } from "@phoenix/hooks/useTimeFormatters";
import { useUTCOffsetMinutes } from "@phoenix/hooks/useUTCOffsetMinutes";
import { intFormatter } from "@phoenix/utils/numberFormatUtils";

import type { ProjectTraceCountSparklineQuery } from "./__generated__/ProjectTraceCountSparklineQuery.graphql";

const SPARKLINE_AXIS_STYLE = {
  fill: "var(--chart-axis-text-color)",
  fontSize: 10,
};
const SPARKLINE_X_TICK_MIN_SPACING = 96;
const SPARKLINE_DEFAULT_X_TICK_COUNT = 8;
const SPARKLINE_X_AXIS_EDGE_PADDING = 28;

type StartBoundedTimeRange = OpenTimeRange & { start: Date };
type TraceCountSparklineDatum = {
  timestamp: number;
  ok: number;
  error: number;
};

function getTraceCountSparklineDatumTimestamp({
  timestamp,
}: TraceCountSparklineDatum) {
  return timestamp;
}

function getStartBoundedTimeRange(
  timeRange: OpenTimeRange
): StartBoundedTimeRange {
  if (timeRange.start) {
    return {
      start: timeRange.start,
      end: timeRange.end,
    };
  }
  const anchorTime = timeRange.end ?? new Date();
  return {
    start: new Date(anchorTime.getTime() - ONE_MONTH_MS),
    end: timeRange.end,
  };
}

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
  const startBoundedTimeRange = useMemo(
    () => getStartBoundedTimeRange(timeRange),
    [timeRange]
  );
  const { fetchKey } = useStreamState();
  const scale = useTimeBinScale({ timeRange: startBoundedTimeRange });
  const utcOffsetMinutes = useUTCOffsetMinutes();
  const sparklineRef = useRef<HTMLDivElement>(null);
  const sparklineDimensions = useDimensions(sparklineRef);

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
        start: startBoundedTimeRange.start.toISOString(),
        end: startBoundedTimeRange.end?.toISOString(),
      },
      timeBinConfig: {
        scale,
        utcOffsetMinutes,
      },
    },
    { fetchKey, fetchPolicy: "store-and-network" }
  );

  const chartData = useMemo<TraceCountSparklineDatum[]>(
    () =>
      (data.project.traceCountByStatusTimeSeries?.data ?? []).map((datum) => ({
        timestamp: new Date(datum.timestamp).getTime(),
        ok: datum.okCount,
        error: datum.errorCount,
      })),
    [data.project.traceCountByStatusTimeSeries?.data]
  );

  const timeTickFormatter = useBinTimeTickFormatter({ scale });
  const xAxisTicks = useTimeAxisTicks({
    data: chartData,
    getTimestamp: getTraceCountSparklineDatumTimestamp,
    width: sparklineDimensions?.width,
    minSpacing: SPARKLINE_X_TICK_MIN_SPACING,
    fallbackCount: SPARKLINE_DEFAULT_X_TICK_COUNT,
  });
  const colors = useSequentialChartColors();
  const semanticColors = useSemanticChartColors();

  return (
    <div ref={sparklineRef} css={sparklineCSS}>
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
                  startBoundedTimeRange.start.getTime(),
                  startBoundedTimeRange.end?.getTime() ?? "dataMax",
                ]}
                tickFormatter={(x) => timeTickFormatter(new Date(x))}
                tickSize={3}
                tickMargin={2}
                ticks={xAxisTicks}
                interval={0}
                padding={{
                  left: SPARKLINE_X_AXIS_EDGE_PADDING,
                  right: SPARKLINE_X_AXIS_EDGE_PADDING,
                }}
                height={16}
                style={SPARKLINE_AXIS_STYLE}
              />
              <YAxis hide />
              <Tooltip
                content={TooltipContent}
                cursor={{ fill: "var(--chart-tooltip-cursor-fill-color)" }}
                allowEscapeViewBox={{ x: false, y: false }}
                reverseDirection={{ y: true }}
                wrapperStyle={defaultChartTooltipWrapperStyle}
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
    <div css={sparklineCSS}>
      <SparklineSkeleton />
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
