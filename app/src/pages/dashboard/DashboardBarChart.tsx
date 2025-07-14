import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";

const color = "#8884d8"; // You can replace with a design token if available

type DashboardBarChartProps = {
  data: { timestamp: string; value: number | null }[];
};

export function DashboardBarChart(props: DashboardBarChartProps) {
  // Optionally, you could use useMemo for chartData if you need to transform data
  return (
    <ResponsiveContainer>
      <BarChart
        data={props.data}
        margin={{ top: 25, right: 18, left: 18, bottom: 50 }}
      >
        <defs>
          <linearGradient id="dashboardBarColor" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={1} />
            <stop offset="95%" stopColor={color} stopOpacity={0.5} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="timestamp"
          style={{ fill: "var(--ac-global-text-color-700)" }}
        />
        <YAxis
          stroke="var(--ac-global-color-grey-500)"
          label={{
            value: "Value",
            angle: -90,
            position: "insideLeft",
            style: {
              textAnchor: "middle",
              fill: "var(--ac-global-text-color-900)",
            },
          }}
          style={{ fill: "var(--ac-global-text-color-700)" }}
        />
        <CartesianGrid
          strokeDasharray="4 4"
          stroke="var(--ac-global-color-grey-500)"
          strokeOpacity={0.5}
        />
        <Bar dataKey="value" fill="url(#dashboardBarColor)" spacing={15} />
      </BarChart>
    </ResponsiveContainer>
  );
}
