import React, { useMemo } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";
import { format } from "d3-format";
import { subDays } from "date-fns";
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

import { Flex, Text, theme, View } from "@arizeai/components";

import {
  ChartTooltip,
  ChartTooltipItem,
  defaultBarChartTooltipProps,
  getBinName,
  useChartColors,
} from "@phoenix/components/chart";
import { useDatasets } from "@phoenix/contexts";
import { useTimeSlice } from "@phoenix/contexts/TimeSliceContext";
import { fullTimeFormatter } from "@phoenix/utils/timeFormatUtils";

import { DimensionDriftBreakdownSegmentBarChartQuery } from "./__generated__/DimensionDriftBreakdownSegmentBarChartQuery.graphql";
// Type interfaces to conform to
type BarChartItem = {
  name: string;
  primaryName: string;
  referenceName: string;
  primaryPercent: number;
  referencePercent: number;
};

const formatter = format(".2f");

const useColors = () => {
  const { primary, reference } = useChartColors();
  return {
    primaryBarColor: primary,
    referenceBarColor: reference,
  };
};

function TooltipContent({
  active,
  payload,
  label,
}: TooltipProps<BarChartItem["primaryPercent"], BarChartItem["name"]>) {
  const { primaryBarColor, referenceBarColor } = useColors();
  if (active && payload && payload.length) {
    const primaryLabel = payload[0]?.payload?.primaryName;
    const primaryValue = payload[0]?.value;
    const referenceLabel = payload[0]?.payload?.referenceName;
    const referenceValue = payload[1]?.value;

    return (
      <ChartTooltip>
        <Text elementType="h3" textSize="medium" weight="heavy">
          {label}
        </Text>
        <ChartTooltipItem
          color={primaryBarColor}
          shape="square"
          name={primaryLabel}
          value={primaryValue != null ? `${formatter(primaryValue)}%` : "--"}
        />
        <ChartTooltipItem
          color={referenceBarColor}
          shape="square"
          name={referenceLabel}
          value={
            referenceValue != null ? `${formatter(referenceValue)}%` : "--"
          }
        />
      </ChartTooltip>
    );
  }

  return null;
}

/**
 * Bar chart that displays the different segments of data for a given dimension
 * at a given time range.
 * E.x. dimension=state, segments=[CA, NY, TX, ...]
 */
export function DimensionDriftBreakdownSegmentBarChart(props: {
  dimensionId: string;
}) {
  const { primaryDataset, referenceDataset } = useDatasets();
  const primaryName = primaryDataset.name;
  const referenceName = referenceDataset?.name || "reference";
  const { selectedTimestamp } = useTimeSlice();
  const endTime = useMemo(
    () => selectedTimestamp ?? new Date(primaryDataset.endTime),
    [selectedTimestamp, primaryDataset.endTime]
  );
  const timeRange = useMemo(() => {
    return {
      start: subDays(endTime, 2).toISOString(),
      end: endTime.toISOString(),
    };
  }, [endTime]);
  const data = useLazyLoadQuery<DimensionDriftBreakdownSegmentBarChartQuery>(
    graphql`
      query DimensionDriftBreakdownSegmentBarChartQuery(
        $dimensionId: GlobalID!
        $timeRange: TimeRange!
      ) {
        dimension: node(id: $dimensionId) {
          id
          ... on Dimension {
            segmentsComparison(primaryTimeRange: $timeRange)
              @required(action: THROW) {
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
                  referenceValue
                }
              }
              totalCounts {
                primaryValue
                referenceValue
              }
            }
          }
        }
      }
    `,
    { dimensionId: props.dimensionId, timeRange: timeRange }
  );

  const chartData = useMemo<BarChartItem[]>(() => {
    const segments = data.dimension.segmentsComparison?.segments ?? [];
    const primaryTotal =
      data.dimension.segmentsComparison?.totalCounts?.primaryValue ?? 0;
    const referenceTotal =
      data.dimension.segmentsComparison?.totalCounts?.referenceValue ?? 0;
    return segments.map((segment) => {
      const primarySegmentCount = segment.counts?.primaryValue ?? 0;
      const referenceSegmentCount = segment.counts?.referenceValue ?? 0;
      const binName = getBinName(segment.bin);
      const primaryPercent = (primarySegmentCount / primaryTotal) * 100;
      const referencePercent = (referenceSegmentCount / referenceTotal) * 100;
      return {
        name: binName,
        primaryName,
        referenceName,
        primaryPercent,
        referencePercent,
      };
    });
  }, [
    data.dimension.segmentsComparison?.segments,
    data.dimension.segmentsComparison?.totalCounts?.primaryValue,
    data.dimension.segmentsComparison?.totalCounts?.referenceValue,
    primaryName,
    referenceName,
  ]);

  const { primaryBarColor, referenceBarColor } = useColors();
  return (
    <Flex direction="column" height="100%">
      <View flex="none" paddingTop="size-100" paddingStart="size-200">
        <Text
          elementType="h3"
          textSize="medium"
          color="text-700"
        >{`Distribution comparison at ${fullTimeFormatter(
          new Date(timeRange.end)
        )}`}</Text>
      </View>
      <View flex>
        <ResponsiveContainer>
          <BarChart
            data={chartData}
            margin={{
              top: 15,
              right: 18,
              left: 18,
              bottom: 5,
            }}
          >
            <defs>
              <linearGradient
                id="dimensionPrimarySegmentsBarColor"
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="5%" stopColor={primaryBarColor} stopOpacity={1} />
                <stop
                  offset="95%"
                  stopColor={primaryBarColor}
                  stopOpacity={0.5}
                />
              </linearGradient>
              <linearGradient
                id="dimensionReferenceSegmentsBarColor"
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop
                  offset="5%"
                  stopColor={referenceBarColor}
                  stopOpacity={1}
                />
                <stop
                  offset="95%"
                  stopColor={referenceBarColor}
                  stopOpacity={0.5}
                />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="name"
              style={{ fill: "var(--ac-global-text-color-700)" }}
            />
            <YAxis
              stroke={theme.colors.gray200}
              label={{
                value: "Percent",
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
              stroke={theme.colors.gray200}
              strokeOpacity={0.5}
            />
            <Tooltip
              {...defaultBarChartTooltipProps}
              content={<TooltipContent />}
            />
            <Bar
              dataKey="primaryPercent"
              fill="url(#dimensionPrimarySegmentsBarColor)"
            />
            <Bar
              dataKey="referencePercent"
              fill="url(#dimensionReferenceSegmentsBarColor)"
            />
          </BarChart>
        </ResponsiveContainer>
      </View>
    </Flex>
  );
}
