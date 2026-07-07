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
import { intFormatter } from "@phoenix/utils/numberFormatUtils";

import type { TopModelsByTokenQuery } from "./__generated__/TopModelsByTokenQuery.graphql";

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
            value={intFormatter(Number(entry.value))}
          />
        ))}
      </ChartTooltip>
    );
  }

  return null;
}

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
    const models = data.project.topModelsByTokenCount ?? [];
    return models.map((model) => {
      const costSummary = model.costSummary;
      const promptTokens = costSummary.prompt.tokens;
      const completionTokens = costSummary.completion.tokens;
      const totalTokens = costSummary.total.tokens;
      return {
        model: model.name,
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        total_tokens: totalTokens,
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
          <Tooltip
            content={TooltipContent}
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
          <Bar
            dataKey="prompt_tokens"
            stackId="a"
            fill={colors.category1}
            hide={isDataKeyHidden("prompt_tokens")}
            name="Prompt tokens"
            radius={[2, 0, 0, 2]}
          />
          <Bar
            dataKey="completion_tokens"
            stackId="a"
            fill={colors.category2}
            hide={isDataKeyHidden("completion_tokens")}
            name="Completion tokens"
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
