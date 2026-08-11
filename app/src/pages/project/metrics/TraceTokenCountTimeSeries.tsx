import { graphql, useLazyLoadQuery } from "react-relay";
import type { TooltipContentProps } from "recharts";
import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from "recharts";

import { Text } from "@phoenix/components";
import {
  ChartEmptyStateOverlay,
  ChartResponsiveContainer,
  ChartTooltip,
  ChartTooltipItem,
  InteractiveLegend,
  TimeRangeChartBrush,
  compactChartMargin,
  compactTimeXAxisProps,
  compactYAxisProps,
  defaultCartesianGridProps,
  defaultTooltipProps,
  compactLegendProps,
  useBinTimeTickFormatter,
  useCategoryChartColors,
  useInteractiveLegend,
} from "@phoenix/components/chart";
import { useTimeBinScale } from "@phoenix/hooks/useTimeBin";
import { useTimeFormatters } from "@phoenix/hooks/useTimeFormatters";
import { useUTCOffsetMinutes } from "@phoenix/hooks/useUTCOffsetMinutes";
import type { ProjectMetricViewProps } from "@phoenix/pages/project/metrics/types";
import {
  PROJECT_METRICS_CHART_SYNC_ID,
  useMetricQueryFetchOptions,
} from "@phoenix/pages/project/metrics/types";
import {
  intFormatter,
  intShortFormatter,
  percentFormatter,
} from "@phoenix/utils/numberFormatUtils";
import {
  compareTokenTypes,
  getTokenDetailColor,
  getTokenDetailLabel,
} from "@phoenix/utils/tokenDetailUtils";

import type { TraceTokenCountTimeSeriesQuery } from "./__generated__/TraceTokenCountTimeSeriesQuery.graphql";
import { getTokenDetailDataKey } from "./tokenDetails";

type TokenCountTimeSeriesDatum = NonNullable<
  NonNullable<
    NonNullable<
      TraceTokenCountTimeSeriesQuery["response"]["project"]
    >["traceTokenCountTimeSeries"]
  >["data"]
>[number];
type TokenDetailsKind = "prompt" | "completion";
type TokenDetailsChartDatum = {
  timestamp: number;
  total: number | null;
  [key: string]: number | null;
};

function getTokenDetails(
  datum: TokenCountTimeSeriesDatum,
  tokenKind: TokenDetailsKind
) {
  return tokenKind === "prompt"
    ? datum.promptTokenCountDetails
    : datum.completionTokenCountDetails;
}

function getTokenTotal(
  datum: TokenCountTimeSeriesDatum,
  tokenKind: TokenDetailsKind
) {
  return tokenKind === "prompt"
    ? datum.promptTokenCount
    : datum.completionTokenCount;
}

function useTraceTokenCountTimeSeriesData({
  projectId,
  timeRange,
}: Pick<ProjectMetricViewProps, "projectId" | "timeRange">) {
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
                promptTokenCountDetails {
                  tokenType
                  tokenCount
                }
                completionTokenCountDetails {
                  tokenType
                  tokenCount
                }
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
    },
    useMetricQueryFetchOptions()
  );

  return {
    data: data.project.traceTokenCountTimeSeries?.data ?? [],
    scale,
  };
}

function TooltipContent({ active, payload, label }: TooltipContentProps) {
  const { fullTimeFormatter } = useTimeFormatters();
  if (active && payload && payload.length) {
    return (
      <ChartTooltip>
        {label && (
          <Text weight="heavy" size="S">{`${fullTimeFormatter(
            new Date(Number(label))
          )}`}</Text>
        )}
        {payload.map((entry) => {
          const name = String(entry.dataKey ?? entry.name ?? "unknown");
          return (
            <ChartTooltipItem
              color={entry.color ?? "transparent"}
              key={name}
              shape="circle"
              name={name}
              value={
                typeof entry.value === "number"
                  ? intFormatter(entry.value)
                  : "--"
              }
            />
          );
        })}
      </ChartTooltip>
    );
  }

  return null;
}

function TokenDetailsTooltipContent({
  active,
  payload,
  label,
}: TooltipContentProps) {
  const { fullTimeFormatter } = useTimeFormatters();
  if (active && payload && payload.length) {
    const total = payload[0]?.payload?.total;
    return (
      <ChartTooltip>
        {label && (
          <Text weight="heavy" size="S">{`${fullTimeFormatter(
            new Date(Number(label))
          )}`}</Text>
        )}
        {payload.map((entry) => {
          const name = String(entry.name ?? entry.dataKey ?? "unknown");
          const value =
            typeof entry.value === "number" ? entry.value : undefined;
          const share =
            value != null && typeof total === "number" && total > 0
              ? ` (${percentFormatter((value / total) * 100)})`
              : "";
          return (
            <ChartTooltipItem
              color={entry.color ?? "transparent"}
              key={String(entry.dataKey ?? entry.name)}
              shape="circle"
              name={name}
              value={value != null ? `${intFormatter(value)}${share}` : "--"}
            />
          );
        })}
      </ChartTooltip>
    );
  }

  return null;
}

export function TraceTokenCountTimeSeries({
  projectId,
  timeRange,
  onTimeRangeSelected,
}: ProjectMetricViewProps) {
  const { data, scale } = useTraceTokenCountTimeSeriesData({
    projectId,
    timeRange,
  });
  const chartData = data.map((datum) => ({
    timestamp: new Date(datum.timestamp).getTime(),
    prompt: datum.promptTokenCount ?? 0,
    completion: datum.completionTokenCount ?? 0,
    total: datum.totalTokenCount,
  }));
  const hasData = chartData.some((datum) => typeof datum.total === "number");

  const timeTickFormatter = useBinTimeTickFormatter({ scale });

  const colors = useCategoryChartColors();
  const { hiddenDataKeys, isDataKeyHidden, toggleDataKey } =
    useInteractiveLegend();
  return (
    <TimeRangeChartBrush onTimeRangeSelected={onTimeRangeSelected}>
      {({ chartProps }) => (
        <ChartEmptyStateOverlay
          isEmpty={!hasData}
          message="No data in this time range"
          chartType="bar"
        >
          <ChartResponsiveContainer>
            <BarChart
              data={chartData}
              margin={compactChartMargin}
              barSize={10}
              syncId={PROJECT_METRICS_CHART_SYNC_ID}
              {...chartProps}
            >
              <CartesianGrid {...defaultCartesianGridProps} />
              <XAxis
                {...compactTimeXAxisProps}
                domain={[timeRange.start.getTime(), timeRange.end.getTime()]}
                tickFormatter={(x) => timeTickFormatter(new Date(x))}
              />
              <YAxis
                {...compactYAxisProps}
                allowDecimals={false}
                tickFormatter={(x) => intShortFormatter(x)}
              />
              <Tooltip
                content={TooltipContent}
                // TODO formalize this
                {...defaultTooltipProps}
              />
              <Bar
                dataKey="prompt"
                stackId="a"
                fill={colors.category1}
                hide={isDataKeyHidden("prompt")}
              />
              <Bar
                dataKey="completion"
                stackId="a"
                fill={colors.category2}
                hide={isDataKeyHidden("completion")}
                radius={[2, 2, 0, 0]}
              />

              <InteractiveLegend
                {...compactLegendProps}
                hiddenDataKeys={hiddenDataKeys}
                iconType="circle"
                iconSize={8}
                onToggleDataKey={toggleDataKey}
              />
            </BarChart>
          </ChartResponsiveContainer>
        </ChartEmptyStateOverlay>
      )}
    </TimeRangeChartBrush>
  );
}

function TraceTokenDetailsTimeSeries({
  projectId,
  timeRange,
  onTimeRangeSelected,
  tokenKind,
}: ProjectMetricViewProps & { tokenKind: TokenDetailsKind }) {
  const { data, scale } = useTraceTokenCountTimeSeriesData({
    projectId,
    timeRange,
  });
  const tokenTypes = Array.from(
    data.reduce((types, datum) => {
      getTokenDetails(datum, tokenKind).forEach((detail) => {
        if ((detail.tokenCount ?? 0) > 0) {
          types.add(detail.tokenType);
        }
      });
      return types;
    }, new Set<string>())
  ).sort(compareTokenTypes);
  const chartData: TokenDetailsChartDatum[] = data.map((datum) => {
    const chartDatum: TokenDetailsChartDatum = {
      timestamp: new Date(datum.timestamp).getTime(),
      total: getTokenTotal(datum, tokenKind),
    };
    const tokenCountsByType = new Map(
      getTokenDetails(datum, tokenKind).map((detail) => [
        detail.tokenType,
        detail.tokenCount ?? 0,
      ])
    );
    tokenTypes.forEach((tokenType) => {
      chartDatum[getTokenDetailDataKey(tokenType)] =
        tokenCountsByType.get(tokenType) ?? 0;
    });
    return chartDatum;
  });
  const hasData = chartData.some((datum) => typeof datum.total === "number");

  const timeTickFormatter = useBinTimeTickFormatter({ scale });

  const colors = useCategoryChartColors();
  const { hiddenDataKeys, isDataKeyHidden, toggleDataKey } =
    useInteractiveLegend();
  return (
    <TimeRangeChartBrush onTimeRangeSelected={onTimeRangeSelected}>
      {({ chartProps }) => (
        <ChartEmptyStateOverlay
          isEmpty={!hasData}
          message="No data in this time range"
          chartType="bar"
        >
          <ChartResponsiveContainer>
            <BarChart
              data={chartData}
              margin={compactChartMargin}
              barSize={10}
              syncId={PROJECT_METRICS_CHART_SYNC_ID}
              {...chartProps}
            >
              <CartesianGrid {...defaultCartesianGridProps} />
              <XAxis
                {...compactTimeXAxisProps}
                domain={[timeRange.start.getTime(), timeRange.end.getTime()]}
                tickFormatter={(x) => timeTickFormatter(new Date(x))}
              />
              <YAxis
                {...compactYAxisProps}
                allowDecimals={false}
                tickFormatter={(x) => intShortFormatter(x)}
              />
              <Tooltip
                content={TokenDetailsTooltipContent}
                // TODO formalize this
                {...defaultTooltipProps}
              />
              {tokenTypes.map((tokenType, index) => {
                const dataKey = getTokenDetailDataKey(tokenType);
                return (
                  <Bar
                    dataKey={dataKey}
                    fill={getTokenDetailColor({ colors, index, tokenType })}
                    hide={isDataKeyHidden(dataKey)}
                    key={dataKey}
                    name={getTokenDetailLabel(tokenType)}
                    radius={
                      index === tokenTypes.length - 1 ? [2, 2, 0, 0] : undefined
                    }
                    stackId="a"
                  />
                );
              })}

              <InteractiveLegend
                {...compactLegendProps}
                hiddenDataKeys={hiddenDataKeys}
                iconType="circle"
                iconSize={8}
                onToggleDataKey={toggleDataKey}
              />
            </BarChart>
          </ChartResponsiveContainer>
        </ChartEmptyStateOverlay>
      )}
    </TimeRangeChartBrush>
  );
}

export function TracePromptTokenDetailsTimeSeries(
  props: ProjectMetricViewProps
) {
  return <TraceTokenDetailsTimeSeries {...props} tokenKind="prompt" />;
}

export function TraceCompletionTokenDetailsTimeSeries(
  props: ProjectMetricViewProps
) {
  return <TraceTokenDetailsTimeSeries {...props} tokenKind="completion" />;
}
