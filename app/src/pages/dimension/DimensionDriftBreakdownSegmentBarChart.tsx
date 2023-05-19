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
  colors,
} from "@phoenix/components/chart";
import { useDatasets } from "@phoenix/contexts";
import { useTimeSlice } from "@phoenix/contexts/TimeSliceContext";
import { assertUnreachable } from "@phoenix/typeUtils";
import { fullTimeFormatter } from "@phoenix/utils/timeFormatUtils";

import {
  DimensionDriftBreakdownSegmentBarChartQuery,
  DimensionDriftBreakdownSegmentBarChartQuery$data,
} from "./__generated__/DimensionDriftBreakdownSegmentBarChartQuery.graphql";
// Type interfaces to conform to
type BarChartItem = {
  name: string;
  primaryName: string;
  referenceName: string;
  primaryPercent: number;
  referencePercent: number;
};

const primaryBarColor = colors.primary;
const referenceBarColor = colors.reference;

type Bin = NonNullable<
  DimensionDriftBreakdownSegmentBarChartQuery$data["dimension"]["segmentsComparison"]
>["segments"][number]["bin"];

/**
 * Formats each bin into a string for charting
 * TODO(mikeldking) - refactor into an interface that can be re-used
 * @param bin
 * @returns
 */
function getBinName(bin: Bin): string {
  const binType = bin.__typename;
  switch (binType) {
    case "NominalBin":
      return bin.name;
    case "IntervalBin":
      // TODO(mikeldking) - add a general case number formatter
      return `${bin.range.start} - ${bin.range.end}`;
    case "MissingValueBin":
      return "(empty)";
    case "%other":
      throw new Error("Unexpected bin type %other");
    default:
      assertUnreachable(binType);
  }
}

const formatter = format(".2f");

function TooltipContent({
  active,
  payload,
  label,
}: TooltipProps<BarChartItem["primaryPercent"], BarChartItem["name"]>) {
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

  return (
    <Flex direction="column" height="100%">
      <View flex="none" paddingTop="size-100" paddingStart="size-200">
        <Text
          elementType="h3"
          textSize="medium"
          color="white70"
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
            <XAxis dataKey="name" style={{ fill: theme.textColors.white70 }} />
            <YAxis
              stroke={theme.colors.gray200}
              label={{
                value: "Percent",
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
            <Tooltip content={<TooltipContent />} />
            <Bar
              dataKey="primaryPercent"
              fill="url(#dimensionPrimarySegmentsBarColor)"
              spacing={5}
            />
            <Bar
              dataKey="referencePercent"
              fill="url(#dimensionReferenceSegmentsBarColor)"
              spacing={5}
            />
          </BarChart>
        </ResponsiveContainer>
      </View>
    </Flex>
  );
}
