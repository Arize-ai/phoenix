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
import { costFormatter } from "@phoenix/utils/numberFormatUtils";

import type { TopModelsByCostQuery } from "./__generated__/TopModelsByCostQuery.graphql";
import { ModelTokenDetailBarShape } from "./ModelTokenDetailBarShape";
import { ModelTokenDetailTooltipContent } from "./ModelTokenDetailTooltipContent";
import {
  buildModelTokenDetailChartData,
  getCostChartEmptyStateMessage,
  getModelTokenDetailColors,
  getModelTokenDetailLabel,
} from "./tokenDetails";

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
            # Tokens recorded in the range whether or not their model is
            # priced, which tells an empty range apart from an unpriced one
            costSummary(timeRange: $timeRange) {
              total {
                tokens
              }
            }
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

  const models = data.project.topModelsByCost ?? [];
  const { chartData, series } = buildModelTokenDetailChartData({
    metric: "cost",
    models,
  });
  const colorByDataKey = getModelTokenDetailColors({ colors, series });
  // A model with no measured usage contributes no series, and a chart with no
  // series has nothing to draw, so it counts as empty however many rows it has.
  const hasData = series.length > 0;
  const emptyStateMessage = getCostChartEmptyStateMessage({
    modelCount: models.length,
    tokenCount: data.project.costSummary?.total?.tokens ?? 0,
  });

  return (
    <ChartEmptyStateOverlay
      isEmpty={!hasData}
      message={emptyStateMessage}
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
                totalLabel="Total cost"
                valueFormatter={costFormatter}
              />
            }
            {...defaultTooltipProps}
          />
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
          {series.map((tokenSeries) => (
            <Bar
              dataKey={tokenSeries.dataKey}
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
              stackId="a"
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
