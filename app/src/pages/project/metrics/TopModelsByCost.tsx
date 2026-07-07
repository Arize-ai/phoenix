import { useMemo } from "react";
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

function TooltipContent({ active, payload, label }: TooltipContentProps) {
  if (active && payload && payload.length) {
    return (
      <ChartTooltip>
        {label && (
          <Text weight="heavy" size="S">
            {String(label)}
          </Text>
        )}
        {payload.map((entry) => (
          <ChartTooltipItem
            color={entry.color ?? "transparent"}
            key={String(entry.dataKey ?? entry.name)}
            shape="circle"
            name={String(entry.name ?? entry.dataKey ?? "unknown")}
            value={costFormatter(Number(entry.value))}
          />
        ))}
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

  const chartData = useMemo(() => {
    const models = data.project.topModelsByCost ?? [];
    return models.map((model) => {
      const costSummary = model.costSummary;
      return {
        model: model.name,
        prompt_cost: costSummary.prompt.cost,
        completion_cost: costSummary.completion.cost,
        total_cost: costSummary.total.cost,
      };
    });
  }, [data]);
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
          <Bar
            dataKey="prompt_cost"
            fill={colors.category1}
            hide={isDataKeyHidden("prompt_cost")}
            name="Prompt cost"
            stackId="a"
            radius={[2, 0, 0, 2]}
          />
          <Bar
            dataKey="completion_cost"
            fill={colors.category2}
            hide={isDataKeyHidden("completion_cost")}
            name="Completion cost"
            stackId="a"
            radius={[0, 2, 2, 0]}
          />
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
