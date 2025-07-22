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

const chartData = [
  {
    model: "gpt-4o",
    prompt_tokens: 400,
    completion_tokens: 500,
    other_tokens: 400,
    total_tokens: 1300,
  },
  {
    model: "gpt-4o-mini",
    prompt_tokens: 300,
    completion_tokens: 400,
    other_tokens: 200,
    total_tokens: 900,
  },
  {
    model: "claude-3-5-sonnet",
    prompt_tokens: 250,
    completion_tokens: 350,
    other_tokens: 100,
    total_tokens: 700,
  },
  {
    model: "claude-3-5-haiku",
    prompt_tokens: 100,
    completion_tokens: 200,
    other_tokens: 150,
    total_tokens: 450,
  },
  {
    model: "gemini-2.0-flash",
    prompt_tokens: 30,
    completion_tokens: 60,
    other_tokens: 10,
    total_tokens: 100,
  },
];

export function TopModelsByToken() {
  const colors = useCategoryChartColors();

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
        <Bar dataKey="completion_tokens" stackId="a" fill={colors.category2} />
        <Bar
          dataKey="other_tokens"
          stackId="a"
          fill={colors.category3}
          radius={[0, 2, 2, 0]}
        />

        <Legend align="left" iconType="circle" iconSize={8} />
      </BarChart>
    </ResponsiveContainer>
  );
}
