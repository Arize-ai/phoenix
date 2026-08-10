import { graphql, useLazyLoadQuery } from "react-relay";
import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from "recharts";

import {
  ChartEmptyStateOverlay,
  ChartResponsiveContainer,
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
import { intFormatter } from "@phoenix/utils/numberFormatUtils";

import type { TopModelsByTokenQuery } from "./__generated__/TopModelsByTokenQuery.graphql";
import { ModelTokenDetailBarShape } from "./ModelTokenDetailBarShape";
import { ModelTokenDetailTooltipContent } from "./ModelTokenDetailTooltipContent";
import {
  buildModelTokenDetailChartData,
  getModelTokenDetailColors,
  getModelTokenDetailLabel,
} from "./tokenDetails";

export function TopModelsByToken({
  projectId,
  timeRange,
}: ProjectMetricViewProps) {
  const colors = useCategoryChartColors();
  const { hiddenDataKeys, isDataKeyHidden, toggleDataKey } =
    useInteractiveLegend();
  const data = useLazyLoadQuery<TopModelsByTokenQuery>(
    graphql`
      query TopModelsByTokenQuery($projectId: ID!, $timeRange: TimeRange!) {
        project: node(id: $projectId) {
          ... on Project {
            topModelsByTokenCount(timeRange: $timeRange) {
              name
              costSummary(projectId: $projectId, timeRange: $timeRange) {
                prompt {
                  tokens
                }
                completion {
                  tokens
                }
                total {
                  tokens
                }
              }
              costDetailSummaryEntries(
                projectId: $projectId
                timeRange: $timeRange
              ) {
                tokenType
                isPrompt
                value {
                  tokens
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
    metric: "tokens",
    models: data.project.topModelsByTokenCount ?? [],
  });
  const colorByDataKey = getModelTokenDetailColors({ colors, series });
  // A model with no measured usage contributes no series, and a chart with no
  // series has nothing to draw, so it counts as empty however many rows it has.
  const hasData = series.length > 0;

  return (
    <ChartEmptyStateOverlay
      isEmpty={!hasData}
      message="No data in this time range"
      chartType="barHorizontal"
    >
      <ChartResponsiveContainer>
        <BarChart
          data={chartData}
          margin={compactChartMargin}
          layout="vertical"
          barSize={10}
        >
          <CartesianGrid {...defaultCartesianGridProps} />
          <Tooltip
            content={
              <ModelTokenDetailTooltipContent
                totalLabel="Total tokens"
                valueFormatter={intFormatter}
              />
            }
            // TODO formalize this
            {...defaultTooltipProps}
          />
          <XAxis
            {...defaultXAxisProps}
            type="number"
            tickLine={false}
            tickFormatter={intFormatter}
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
          {series.map((tokenSeries) => (
            <Bar
              dataKey={tokenSeries.dataKey}
              stackId="a"
              fill={colorByDataKey.get(tokenSeries.dataKey)}
              hide={isDataKeyHidden(tokenSeries.dataKey)}
              key={tokenSeries.dataKey}
              name={getModelTokenDetailLabel({
                allSeries: series,
                series: tokenSeries,
              })}
              shape={
                <ModelTokenDetailBarShape
                  allSeries={series}
                  isDataKeyHidden={isDataKeyHidden}
                  series={tokenSeries}
                />
              }
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
      </ChartResponsiveContainer>
    </ChartEmptyStateOverlay>
  );
}
