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
import type { TopModelsByCostQuery } from "@phoenix/pages/project/__generated__/TopModelsByCostQuery.graphql";

export function TopModelsByCost({ projectId }: { projectId: string }) {
  const { timeRange } = useTimeRange();
  const colors = useCategoryChartColors();

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
    }
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

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={chartData}
        margin={{ top: 0, right: 18, left: 0, bottom: 0 }}
        layout="vertical"
        barSize={6}
      >
        <CartesianGrid {...defaultCartesianGridProps} vertical={false} />
        <XAxis
          {...defaultXAxisProps}
          type="number"
          tickLine={false}
          tickFormatter={(value) => `$${value}`}
        />
        <YAxis
          {...defaultYAxisProps}
          dataKey="model"
          type="category"
          width={120}
        />
        <Bar
          dataKey="prompt_cost"
          fill={colors.category1}
          stackId="a"
          radius={[2, 0, 0, 2]}
        />
        <Bar
          dataKey="completion_cost"
          fill={colors.category2}
          stackId="a"
          radius={[0, 2, 2, 0]}
        />
        <Legend align="left" iconType="circle" iconSize={8} />
      </BarChart>
    </ResponsiveContainer>
  );
}
