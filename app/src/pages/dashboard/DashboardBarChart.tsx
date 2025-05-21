import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";

// Demo data
const data = [
  { name: "Page A", uv: 4000, pv: 2400, amt: 2400 },
  { name: "Page B", uv: 3000, pv: 1398, amt: 2210 },
  { name: "Page C", uv: 2000, pv: 9800, amt: 2290 },
  { name: "Page D", uv: 2780, pv: 3908, amt: 2000 },
  { name: "Page E", uv: 1890, pv: 4800, amt: 2181 },
  { name: "Page F", uv: 2390, pv: 3800, amt: 2500 },
  { name: "Page G", uv: 3490, pv: 4300, amt: 2100 },
];

const color = "#8884d8"; // You can replace with a design token if available

export function DashboardBarChart() {
  // Optionally, you could use useMemo for chartData if you need to transform data
  return (
    <ResponsiveContainer>
      <BarChart
        data={data}
        margin={{ top: 25, right: 18, left: 18, bottom: 50 }}
      >
        <defs>
          <linearGradient id="dashboardBarColor" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={1} />
            <stop offset="95%" stopColor={color} stopOpacity={0.5} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="name"
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
        <Bar dataKey="pv" fill="url(#dashboardBarColor)" spacing={15} />
      </BarChart>
    </ResponsiveContainer>
  );
}
