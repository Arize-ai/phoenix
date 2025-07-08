import React, { useState } from "react";
import {
  Bar,
  BarChart as RechartsBarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  TooltipProps,
  XAxis,
  YAxis,
} from "recharts";

import { ChartTooltip, ChartTooltipItem } from "./ChartTooltip";
import { defaultBarChartTooltipProps } from "./defaults";

export interface BarChartDataPoint {
  name: string;
  value: number;
  [key: string]: string | number;
}

export interface BarChartProps {
  data: BarChartDataPoint[];
  xAxisKey?: string;
  yAxisKey?: string;
  xAxisLabel?: string;
  yAxisLabel?: string;
  barSize?: "auto" | "sm" | "md" | "lg";
  showGrid?: boolean;
  showTooltip?: boolean;
  height?: number;
  tooltipFormatter?: (value: number, name: string) => string;
  tooltipProps?: Partial<TooltipProps<number, string>>;
}

interface CustomTooltipProps extends TooltipProps<number, string> {
  formatter?: (value: number, name: string) => string;
}

const CustomTooltip = ({
  active,
  payload,
  label,
  formatter,
}: CustomTooltipProps) => {
  if (active && payload && payload.length > 0) {
    const dataPoint = payload[0];
    if (dataPoint && dataPoint.value !== undefined) {
      return (
        <ChartTooltip>
          <ChartTooltipItem
            shape="circle"
            color="var(--ac-global-chart-bar-blue-gradient-start)"
            name={label || ""}
            value={
              formatter
                ? formatter(dataPoint.value, label || "")
                : dataPoint.value.toString()
            }
          />
        </ChartTooltip>
      );
    }
  }
  return null;
};

function getBarSize(size: "auto" | "sm" | "md" | "lg"): number | undefined {
  const sizeMap = {
    auto: undefined, // Let recharts handle auto-sizing
    sm: 8,
    md: 16,
    lg: 32,
  };
  return sizeMap[size];
}

export function BarChart({
  data,
  xAxisKey = "name",
  yAxisKey = "value",
  xAxisLabel,
  yAxisLabel,
  barSize = "auto",
  showGrid = true,
  showTooltip = true,
  height = 300,
  tooltipFormatter,
  tooltipProps,
}: BarChartProps) {
  const maxBarSize = getBarSize(barSize);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Generate unique IDs for gradients to avoid conflicts.
  // Without this, charts with different styles or color modes
  // risk overwriting siblings that shouldn't be in scope.
  const chartId = React.useId();
  const activeGradientId = `barGradientActive-${chartId}`;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsBarChart
        data={data}
        margin={{
          top: 20,
          right: 30,
          left: 0,
          bottom: 5,
        }}
        onMouseMove={(state) => {
          if (state && state.activeTooltipIndex !== undefined) {
            setHoveredIndex(state.activeTooltipIndex);
          }
        }}
        onMouseLeave={() => setHoveredIndex(null)}
      >
        <defs>
          <linearGradient id={activeGradientId} x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="0%"
              stopColor="var(--ac-global-chart-bar-blue-gradient-start)"
            />
            <stop
              offset="100%"
              stopColor="var(--ac-global-chart-bar-blue-gradient-end)"
            />
          </linearGradient>
        </defs>
        {showGrid && (
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--ac-global-chart-grid-line-color)"
            vertical={false}
          />
        )}
        <XAxis
          dataKey={xAxisKey}
          label={
            xAxisLabel
              ? {
                  value: xAxisLabel,
                  position: "insideBottom",
                  offset: -5,
                  style: {
                    fill: "var(--ac-global-chart-axis-label-color)",
                  },
                }
              : undefined
          }
          stroke="var(--ac-global-chart-border-line-color)"
          style={{ fill: "var(--ac-global-chart-axis-text-color)" }}
        />
        <YAxis
          label={
            yAxisLabel
              ? {
                  value: yAxisLabel,
                  angle: -90,
                  position: "insideLeft",
                  style: {
                    fill: "var(--ac-global-chart-axis-label-color)",
                  },
                }
              : undefined
          }
          stroke="var(--ac-global-chart-border-line-color)"
          style={{ fill: "var(--ac-global-chart-axis-text-color)" }}
        />
        {showTooltip && (
          <Tooltip
            content={<CustomTooltip formatter={tooltipFormatter} />}
            {...defaultBarChartTooltipProps}
            {...tooltipProps}
          />
        )}
        <Bar dataKey={yAxisKey} radius={[2, 2, 0, 0]} maxBarSize={maxBarSize}>
          {data.map((_, index) => {
            const isHovered = hoveredIndex === index;
            const shouldDisable = hoveredIndex !== null && !isHovered;
            const opacity = shouldDisable
              ? "var(--ac-global-chart-bar-disabled-opacity)"
              : "var(--ac-global-chart-bar-resting-opacity)";

            return (
              <Cell
                key={`cell-${index}`}
                fill={`url(#${activeGradientId})`}
                style={{ opacity }}
              />
            );
          })}
        </Bar>
      </RechartsBarChart>
    </ResponsiveContainer>
  );
}
