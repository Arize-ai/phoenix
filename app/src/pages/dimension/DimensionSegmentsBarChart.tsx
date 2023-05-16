import React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";

import { theme } from "@arizeai/components";

import { colors } from "@phoenix/components/chart";
const data = [
  {
    name: "Page A",
    uv: 4000,
    pv: 2400,
  },
  {
    name: "Page B",
    uv: 3000,
    pv: 1398,
  },
  {
    name: "Page C",
    uv: 2000,
    pv: 9800,
  },
  {
    name: "Page D",
    uv: 2780,
    pv: 3908,
  },
  {
    name: "Page E",
    uv: 1890,
    pv: 4800,
  },
  {
    name: "Page F",
    uv: 2390,
    pv: 3800,
  },
  {
    name: "Page G",
    uv: 3490,
    pv: 4300,
  },
];

const barColor = colors.primary;

export function DimensionSegmentsBarChart() {
  return (
    <ResponsiveContainer>
      <BarChart
        data={data as unknown as any[]}
        margin={{
          top: 25,
          right: 18,
          left: 18,
          bottom: 10,
        }}
      >
        <defs>
          <linearGradient
            id="dimensionSegmentsBarColor"
            x1="0"
            y1="0"
            x2="0"
            y2="1"
          >
            <stop offset="5%" stopColor={barColor} stopOpacity={1} />
            <stop offset="95%" stopColor={barColor} stopOpacity={0.5} />
          </linearGradient>
        </defs>
        <XAxis dataKey="name" style={{ fill: theme.textColors.white70 }} />
        <YAxis
          stroke={theme.colors.gray200}
          label={{
            value: "% Volume",
            angle: -90,
            position: "insideLeft",
            style: { textAnchor: "middle", fill: theme.textColors.white90 },
          }}
          style={{ fill: theme.textColors.white70 }}
        />
        <CartesianGrid
          strokeDasharray="4 4"
          stroke={theme.colors.gray200}
          strokeOpacity={0.5}
        />
        <Bar dataKey="uv" fill="url(#dimensionSegmentsBarColor)" spacing={5} />
      </BarChart>
    </ResponsiveContainer>
  );
}
