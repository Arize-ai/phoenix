import React, { useMemo } from "react";
import { graphql, useFragment } from "react-relay";
import { format } from "d3-format";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  TooltipProps,
  XAxis,
  YAxis,
} from "recharts";

import { theme } from "@arizeai/components";

import {
  ChartTooltip,
  ChartTooltipItem,
  colors,
  defaultBarChartTooltipProps,
  getBinName,
} from "@phoenix/components/chart";

import { DimensionSegmentsBarChart_dimension$key } from "./__generated__/DimensionSegmentsBarChart_dimension.graphql";

// Type interfaces to conform to
type BarChartItem = {
  name: string;
  percent: number;
};

const barColor = colors.primary;

const formatter = format(".2f");

function TooltipContent({
  active,
  payload,
  label,
}: TooltipProps<BarChartItem["percent"], BarChartItem["name"]>) {
  if (active && payload && payload.length) {
    const value = payload[0]?.value;
    return (
      <ChartTooltip>
        <ChartTooltipItem
          color={barColor}
          shape="square"
          name={label}
          value={value != null ? `${formatter(value)}%` : "--"}
        />
      </ChartTooltip>
    );
  }

  return null;
}

/**
 * Bar chart that displays the different segments of data for a given dimension
 * E.x. dimension=state, segments=[CA, NY, TX, ...]
 */
export function DimensionSegmentsBarChart(props: {
  dimension: DimensionSegmentsBarChart_dimension$key;
}) {
  const data = useFragment<DimensionSegmentsBarChart_dimension$key>(
    graphql`
      fragment DimensionSegmentsBarChart_dimension on Dimension
      @argumentDefinitions(timeRange: { type: "TimeRange!" }) {
        id
        segmentsComparison(primaryTimeRange: $timeRange) {
          segments {
            bin {
              ... on NominalBin {
                __typename
                name
              }
              ... on IntervalBin {
                __typename
                range {
                  start
                  end
                }
              }
              ... on MissingValueBin {
                __typename
              }
            }
            counts {
              primaryValue
            }
          }
          totalCounts {
            primaryValue
          }
        }
      }
    `,
    props.dimension
  );

  const chartData = useMemo<BarChartItem[]>(() => {
    const segments = data.segmentsComparison?.segments ?? [];
    const total = data.segmentsComparison?.totalCounts?.primaryValue ?? 0;
    return segments.map((segment) => {
      const segmentCount = segment.counts?.primaryValue ?? 0;
      const binName = getBinName(segment.bin);
      const percent = (segmentCount / total) * 100;
      return {
        name: binName,
        percent,
      };
    });
  }, [data]);

  return (
    <ResponsiveContainer>
      <BarChart
        data={chartData}
        margin={{
          top: 25,
          right: 18,
          left: 18,
          bottom: 5,
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
        <Tooltip
          {...defaultBarChartTooltipProps}
          content={<TooltipContent />}
        />
        <Bar
          dataKey="percent"
          fill="url(#dimensionSegmentsBarColor)"
          spacing={15}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
