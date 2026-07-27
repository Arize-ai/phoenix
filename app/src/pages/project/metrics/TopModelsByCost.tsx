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
  ChartTooltipDivider,
  ChartTooltipItem,
  InteractiveLegend,
  compactChartMargin,
  defaultCartesianGridProps,
  defaultTooltipProps,
  compactLegendProps,
  defaultXAxisProps,
  defaultYAxisProps,
  truncateModelName,
  useCategoryChartColors,
  useInteractiveLegend,
} from "@phoenix/components/chart";
import type { ProjectMetricViewProps } from "@phoenix/pages/project/metrics/types";
import { useMetricQueryFetchOptions } from "@phoenix/pages/project/metrics/types";
import {
  costFormatter,
  percentFormatter,
} from "@phoenix/utils/numberFormatUtils";

import type { TopModelsByCostQuery } from "./__generated__/TopModelsByCostQuery.graphql";
import {
  buildModelTokenDetailChartData,
  getModelTokenDetailBarRadius,
  getModelTokenDetailLabel,
  getTokenDetailColor,
} from "./tokenDetails";

function TooltipContent({ active, payload, label }: TooltipContentProps) {
  if (active && payload && payload.length) {
    const total = payload[0]?.payload?.total;
    return (
      <ChartTooltip>
        {label && (
          <Text weight="heavy" size="S">
            {String(label)}
          </Text>
        )}
        {payload.map((entry) => {
          const value = Number(entry.value);
          const share =
            typeof total === "number" && total > 0
              ? ` (${percentFormatter((value / total) * 100)})`
              : "";
          return (
            <ChartTooltipItem
              color={entry.color ?? "transparent"}
              key={String(entry.dataKey ?? entry.name)}
              shape="circle"
              name={String(entry.name ?? entry.dataKey ?? "unknown")}
              value={`${costFormatter(value)}${share}`}
            />
          );
        })}
        <ChartTooltipDivider />
        <ChartTooltipItem
          name="Total cost"
          value={costFormatter(typeof total === "number" ? total : 0)}
        />
      </ChartTooltip>
    );
  }

  return null;
}

export function TopModelsByCost({
  projectId,
  timeRange,
}: ProjectMetricViewProps) {
  const colors = useCategoryChartColors();
  const { hiddenDataKeys, isDataKeyHidden, toggleDataKey } =
    useInteractiveLegend();

  const data = useLazyLoadQuery<TopModelsByCostQuery>(
    graphql`
      query TopModelsByCostQuery($projectId: ID!, $timeRange: TimeRange!) {
        project: node(id: $projectId) {
          ... on Project {
            topModelsByCost(timeRange: $timeRange) {
              name
              costSummary(projectId: $projectId, timeRange: $timeRange) {
                prompt {
                  cost
                }
                completion {
                  cost
                }
                total {
                  cost
                }
              }
              costDetailSummaryEntries(
                projectId: $projectId
                timeRange: $timeRange
              ) {
                tokenType
                isPrompt
                value {
                  cost
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
    },
    useMetricQueryFetchOptions()
  );

  const { chartData, series } = buildModelTokenDetailChartData({
    metric: "cost",
    models: data.project.topModelsByCost ?? [],
  });
  const hasData = chartData.length > 0;

  return (
    <ChartEmptyStateOverlay
      isEmpty={!hasData}
      message="No data in this time range"
      chartType="barHorizontal"
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          margin={compactChartMargin}
          layout="vertical"
          barSize={10}
        >
          <CartesianGrid {...defaultCartesianGridProps} />
          <Tooltip content={TooltipContent} {...defaultTooltipProps} />
          <XAxis
            {...defaultXAxisProps}
            type="number"
            tickLine={false}
            tickFormatter={costFormatter}
          />
          <YAxis
            {...defaultYAxisProps}
            dataKey="model"
            type="category"
            width={120}
            axisLine={false}
            tickLine={false}
            tickMargin={4}
            tickFormatter={truncateModelName}
          />
          {series.map((tokenSeries, index) => (
            <Bar
              dataKey={tokenSeries.dataKey}
              fill={getTokenDetailColor({
                colors,
                index,
                tokenType: tokenSeries.tokenType,
              })}
              hide={isDataKeyHidden(tokenSeries.dataKey)}
              key={tokenSeries.dataKey}
              name={getModelTokenDetailLabel({
                allSeries: series,
                series: tokenSeries,
              })}
              stackId="a"
              radius={getModelTokenDetailBarRadius({
                index,
                seriesCount: series.length,
              })}
            />
          ))}
          <InteractiveLegend
            {...compactLegendProps}
            hiddenDataKeys={hiddenDataKeys}
            iconType="circle"
            iconSize={8}
            onToggleDataKey={toggleDataKey}
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartEmptyStateOverlay>
  );
}
