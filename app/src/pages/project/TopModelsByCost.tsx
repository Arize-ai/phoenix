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
import { useTimeRange } from "@phoenix/components/datetime";
import type { TopModelsByCostQuery } from "@phoenix/pages/project/__generated__/TopModelsByCostQuery.graphql";
import { costFormatter } from "@phoenix/utils/numberFormatUtils";

function TooltipContent({
  active,
  payload,
  label,
}: TooltipContentProps<number, string>) {
  const colors = useCategoryChartColors();

  if (active && payload && payload.length) {
    const promptCost = payload[0]?.value ?? null;
    const completionCost = payload[1]?.value ?? null;

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
          name="Prompt cost"
          value={costFormatter(promptCost)}
        />
        <ChartTooltipItem
          color={colors.category2}
          shape="circle"
          name="Completion cost"
          value={costFormatter(completionCost)}
        />
      </ChartTooltip>
    );
  }

  return null;
}

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
        <Tooltip
          content={TooltipContent}
          // TODO formalize this
          cursor={{ fill: "var(--chart-tooltip-cursor-fill-color)" }}
        />
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
        <Legend {...defaultLegendProps} iconType="circle" iconSize={8} />
      </BarChart>
    </ResponsiveContainer>
  );
}
