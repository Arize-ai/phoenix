import { useMemo } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";

import {
  defaultCartesianGridProps,
  defaultXAxisProps,
  defaultYAxisProps,
  useCategoryChartColors,
} from "@phoenix/components/chart";
import { useTimeRange } from "@phoenix/components/datetime";
import type { TopModelsByTokenQuery } from "@phoenix/pages/project/__generated__/TopModelsByTokenQuery.graphql";

export function TopModelsByToken({ projectId }: { projectId: string }) {
  const { timeRange } = useTimeRange();
  const colors = useCategoryChartColors();
  const data = useLazyLoadQuery<TopModelsByTokenQuery>(
    graphql`
      query TopModelsByTokenQuery($projectId: ID!, $timeRange: TimeRange!) {
        project: node(id: $projectId) {
          ... on Project {
            topModelsByTokenCount(timeRange: $timeRange) {
              models {
                id
                name
              }
              costSummaries {
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
    const models = data.project.topModelsByTokenCount?.models ?? [];
    const costSummaries =
      data.project.topModelsByTokenCount?.costSummaries ?? [];
    return models.map((model, idx) => {
      const costSummary = costSummaries[idx];
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
        margin={{ top: 0, right: 18, left: 0, bottom: 0 }}
        layout="vertical"
        barSize={6}
      >
        <CartesianGrid {...defaultCartesianGridProps} vertical={false} />
        <XAxis {...defaultXAxisProps} type="number" tickLine={false} />
        <YAxis
          {...defaultYAxisProps}
          dataKey="model"
          type="category"
          width={120}
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
        <Legend align="left" iconType="circle" iconSize={8} />
      </BarChart>
    </ResponsiveContainer>
  );
}
