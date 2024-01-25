import React, { useState } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";
import { format } from "d3-format";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  LegendProps,
  Line,
  ResponsiveContainer,
  Tooltip,
  TooltipProps,
  XAxis,
  YAxis,
} from "recharts";

import { Text, theme } from "@arizeai/components";

import {
  ChartTooltip,
  ChartTooltipItem,
  defaultTimeXAxisProps,
  useChartColors,
  useTimeTickFormatter,
} from "@phoenix/components/chart";
import { useTimeRange } from "@phoenix/contexts/TimeRangeContext";
import { fullTimeFormatter } from "@phoenix/utils/timeFormatUtils";
import { calculateGranularity } from "@phoenix/utils/timeSeriesUtils";

import { DimensionQuantilesTimeSeriesQuery } from "./__generated__/DimensionQuantilesTimeSeriesQuery.graphql";
import { timeSeriesChartMargins } from "./dimensionChartConstants";

/**
 * Quantiles are floats so we want to create a trimmed down version of the significant digits
 */
const yTickFormatter = format("~s");

enum Label {
  p99_p01 = "p99_p01",
  p75_p25 = "p75_p25",
  p50 = "p50",
}

/**
 * Track whether each label is hidden or not. boolean true means hidden.
 */
type ChartState = { [label in Label]: boolean };
type ChartDataItem = {
  timestamp: number;
  [Label.p99_p01]: [number | null, number | null];
  [Label.p75_p25]: [number | null, number | null];
  [Label.p50]: number | null;
};

const numberFormatter = new Intl.NumberFormat([], {
  maximumFractionDigits: 2,
});

function formatValue(value: number | null) {
  return typeof value === "number" ? numberFormatter.format(value) : "--";
}

const useColors = () => {
  const colors = useChartColors();
  return {
    outerColor: colors.gray500,
    innerColor: colors.gray300,
    lineColor: colors.default,
  };
};
function TooltipContent({
  active,
  payload,
  label,
}: TooltipProps<number | Array<number | string>, string>) {
  const { outerColor, innerColor, lineColor } = useColors();
  if (active && payload && payload.length) {
    const data: ChartDataItem = payload[0].payload;
    return (
      <ChartTooltip>
        <Text weight="heavy" textSize="medium">{`${fullTimeFormatter(
          new Date(label)
        )}`}</Text>
        <ChartTooltipItem
          color={outerColor}
          name="p99"
          value={formatValue(data[Label.p99_p01][0])}
        />
        <ChartTooltipItem
          color={innerColor}
          name="p75"
          value={formatValue(data[Label.p75_p25][0])}
        />
        <ChartTooltipItem
          color={lineColor}
          name="p50"
          value={formatValue(data.p50)}
        />
        <ChartTooltipItem
          color={innerColor}
          name="p25"
          value={formatValue(data[Label.p75_p25][1])}
        />
        <ChartTooltipItem
          color={outerColor}
          name="p01"
          value={formatValue(data[Label.p99_p01][1])}
        />
      </ChartTooltip>
    );
  }

  return null;
}
export function DimensionQuantilesTimeSeries({
  dimensionId,
}: {
  dimensionId: string;
}) {
  const { timeRange } = useTimeRange();
  const granularity = calculateGranularity(timeRange);
  const data = useLazyLoadQuery<DimensionQuantilesTimeSeriesQuery>(
    graphql`
      query DimensionQuantilesTimeSeriesQuery(
        $dimensionId: GlobalID!
        $timeRange: TimeRange!
        $granularity: Granularity!
      ) {
        dimension: node(id: $dimensionId) {
          id
          ... on Dimension {
            p99TimeSeries: dataQualityTimeSeries(
              metric: p99
              timeRange: $timeRange
              granularity: $granularity
            ) {
              data {
                timestamp
                value
              }
            }
            p75TimeSeries: dataQualityTimeSeries(
              metric: p75
              timeRange: $timeRange
              granularity: $granularity
            ) {
              data {
                timestamp
                value
              }
            }
            p50TimeSeries: dataQualityTimeSeries(
              metric: p50
              timeRange: $timeRange
              granularity: $granularity
            ) {
              data {
                timestamp
                value
              }
            }
            p25TimeSeries: dataQualityTimeSeries(
              metric: p25
              timeRange: $timeRange
              granularity: $granularity
            ) {
              data {
                timestamp
                value
              }
            }
            p01TimeSeries: dataQualityTimeSeries(
              metric: p01
              timeRange: $timeRange
              granularity: $granularity
            ) {
              data {
                timestamp
                value
              }
            }
          }
        }
      }
    `,
    {
      dimensionId,
      timeRange: {
        start: timeRange.start.toISOString(),
        end: timeRange.end.toISOString(),
      },
      granularity,
    }
  );

  const p99data = data.dimension.p99TimeSeries?.data.map((d) => d) || [];
  const p01data = data.dimension.p01TimeSeries?.data.map((d) => d) || [];
  const p75data = data.dimension.p75TimeSeries?.data.map((d) => d) || [];
  const p25data = data.dimension.p25TimeSeries?.data.map((d) => d) || [];
  const p50data = data.dimension.p50TimeSeries?.data.map((d) => d) || [];

  const chartData = p99data.map((d, i) => {
    return {
      timestamp: new Date(d.timestamp).valueOf(),
      p99_p01: [d.value, p01data[i].value],
      p75_p25: [p75data[i].value, p25data[i].value],
      p50: p50data[i].value,
    };
  });

  const timeTickFormatter = useTimeTickFormatter({
    samplingIntervalMinutes: granularity.samplingIntervalMinutes,
  });

  // Legend interactivity
  const [chartState, setChartState] = useState<ChartState>(
    Object.keys(Label).reduce((a, key) => {
      a[key as Label] = false;
      return a;
    }, {} as ChartState)
  );

  const handleLegendMouseOver: LegendProps["onMouseOver"] = (e) => {
    if (!chartState[e.dataKey as Label]) {
      setChartState({ ...chartState });
    }
  };

  const handleLegendMouseOut: LegendProps["onMouseOut"] = () => {
    setChartState({ ...chartState });
  };

  const selectChartItem: LegendProps["onClick"] = (e) => {
    setChartState({
      ...chartState,
      [String(e.dataKey)]: !chartState[e.dataKey as Label],
    });
  };

  const { outerColor, innerColor, lineColor } = useColors();

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart
        data={chartData}
        margin={timeSeriesChartMargins}
        syncId={"dimensionDetails"}
      >
        <defs>
          <linearGradient id="p99_p01ColorUV" x1="0" y1="0" x2="0" y2="1">
            <stop offset="10%" stopColor={outerColor} stopOpacity={0.7} />
            <stop offset="50%" stopColor={outerColor} stopOpacity={0.3} />
            <stop offset="90%" stopColor={outerColor} stopOpacity={0.7} />
          </linearGradient>
          <linearGradient id="p75_p25ColorUV" x1="0" y1="0" x2="0" y2="1">
            <stop offset="10%" stopColor={innerColor} stopOpacity={0.7} />
            <stop offset="50%" stopColor={innerColor} stopOpacity={0.3} />
            <stop offset="90%" stopColor={innerColor} stopOpacity={0.7} />
          </linearGradient>
        </defs>
        <XAxis
          {...defaultTimeXAxisProps}
          tickFormatter={(x) => timeTickFormatter(new Date(x))}
        />
        <YAxis
          stroke={theme.colors.gray200}
          label={{
            value: "Value",
            angle: -90,
            position: "insideLeft",
            style: {
              textAnchor: "middle",
              fill: "var(--ac-global-text-color-900)",
            },
          }}
          tickFormatter={(x) => yTickFormatter(x)}
          style={{ fill: "var(--ac-global-text-color-700)" }}
        />
        <CartesianGrid
          strokeDasharray="4 4"
          stroke={theme.colors.gray200}
          strokeOpacity={0.5}
        />
        <Tooltip content={<TooltipContent />} />
        <Legend
          onClick={selectChartItem}
          onMouseOver={handleLegendMouseOver}
          onMouseOut={handleLegendMouseOut}
        />
        <Area
          type="monotone"
          dataKey={Label.p99_p01}
          name="p99 - p01"
          fillOpacity={1}
          fill="url(#p99_p01ColorUV)"
          stroke={outerColor}
          hide={chartState[Label.p99_p01] === true}
        />
        <Area
          type="monotone"
          dataKey={Label.p75_p25}
          name="p75 - p25"
          fillOpacity={1}
          stroke={innerColor}
          fill="url(#p75_p25ColorUV)"
          hide={chartState[Label.p75_p25] === true}
        />
        <Line
          type="monotone"
          dataKey={Label.p50}
          stroke={lineColor}
          hide={chartState[Label.p50] === true}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
