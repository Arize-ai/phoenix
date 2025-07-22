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
import type { TopModelsByCostQuery } from "@phoenix/pages/project/__generated__/TopModelsByCostQuery.graphql";

const chartData = [
  {
    model: "gpt-4o",
    prompt_cost: 400,
    completion_cost: 500,
    other_cost: 100,
    total_cost: 1000,
  },
  {
    model: "gpt-4o-mini",
    prompt_cost: 300,
    completion_cost: 400,
    other_cost: 100,
    total_cost: 800,
  },
  {
    model: "claude-3-5-sonnet",
    prompt_cost: 250,
    completion_cost: 350,
    other_cost: 100,
    total_cost: 700,
  },
  {
    model: "claude-3-5-haiku",
    prompt_cost: 100,
    completion_cost: 200,
    other_cost: 50,
    total_cost: 350,
  },
  {
    model: "gemini-2.0-flash",
    prompt_cost: 30,
    completion_cost: 60,
    other_cost: 10,
    total_cost: 100,
  },
];

export function TopModelsByCost({ projectId }: { projectId: string }) {
  const colors = useCategoryChartColors();

  const data = useLazyLoadQuery<TopModelsByCostQuery>(
    graphql`
      query TopModelsByCostQuery($projectId: ID!) {
        project: node(id: $projectId) {
          ... on Project {
            topModelsByCost {
              id
              name
              costSummary {
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
    }
  );

  const chartData = useMemo(() => {
    return data.project?.topModelsByCost?.map((model) => {
      return {
        model: model.name,
        prompt_cost: model.costSummary.prompt.cost,
        completion_cost: model.costSummary.completion.cost,
        total_cost: model.costSummary.total.cost,
      };
    });
  }, [data]);

  console.log(chartData);

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
