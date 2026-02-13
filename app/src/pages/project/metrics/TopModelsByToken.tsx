import { useMemo } from "react";
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
  useCategoryChartColors,
} from "@phoenix/components/chart";
import { ProjectMetricViewProps } from "@phoenix/pages/project/metrics/types";
import { intFormatter } from "@phoenix/utils/numberFormatUtils";

import type { TopModelsByTokenQuery } from "./__generated__/TopModelsByTokenQuery.graphql";

const MAX_MODEL_NAME_LENGTH = 14;

/**
 * Truncates a model name if it exceeds the maximum length.
 * Uses ellipsis at the end   .
 */
function truncateModelName(value: unknown): string {
  if (typeof value !== "string") {
    return String(value);
  }
  if (value.length <= MAX_MODEL_NAME_LENGTH) {
    return value;
  }
  return value.slice(0, MAX_MODEL_NAME_LENGTH) + "...";
}

function TooltipContent({
  active,
  payload,
  label,
}: TooltipContentProps<number, string>) {
  const colors = useCategoryChartColors();

  if (active && payload && payload.length) {
    const promptTokens = payload[0]?.value ?? null;
    const completionTokens = payload[1]?.value ?? null;

    return (
      <ChartTooltip>
        {label && (
          <Text weight="heavy" size="S">
            {label}
          </Text>
        )}
        <ChartTooltipItem
          color={colors.category1}
          shape="circle"
          name="Prompt tokens"
          value={intFormatter(promptTokens)}
        />
        <ChartTooltipItem
          color={colors.category2}
          shape="circle"
          name="Completion tokens"
          value={intFormatter(completionTokens)}
        />
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
    }
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

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={chartData}
        margin={{ top: 0, right: 18, left: 8, bottom: 0 }}
        layout="vertical"
        barSize={10}
      >
        <CartesianGrid {...defaultCartesianGridProps} vertical={false} />
        <Tooltip
          content={TooltipContent}
          // TODO formalize this
          cursor={{ fill: "var(--chart-tooltip-cursor-fill-color)" }}
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
          tickFormatter={truncateModelName}
        />
        <Bar
          dataKey="prompt_tokens"
          stackId="a"
          fill={colors.category1}
          radius={[2, 0, 0, 2]}
        />
        <Bar
          dataKey="completion_tokens"
          stackId="a"
          fill={colors.category2}
          radius={[0, 2, 2, 0]}
        />
        <Legend {...defaultLegendProps} iconType="circle" iconSize={8} />
      </BarChart>
    </ResponsiveContainer>
  );
}
