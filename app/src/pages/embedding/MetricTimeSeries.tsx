import React, { useCallback } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  TooltipProps,
  XAxis,
  YAxis,
} from "recharts";
import { CategoricalChartFunc } from "recharts/types/chart/generateCategoricalChart";
import { css } from "@emotion/react";

import {
  Content,
  ContextualHelp,
  Heading,
  Icon,
  InfoOutline,
  Text,
  theme,
} from "@arizeai/components";

import {
  ChartTooltip,
  ChartTooltipDivider,
  ChartTooltipItem,
  defaultSelectedTimestampReferenceLineProps,
  defaultTimeXAxisProps,
  useChartColors,
} from "@phoenix/components/chart";
import { useTimeTickFormatter } from "@phoenix/components/chart";
import { usePointCloudContext } from "@phoenix/contexts";
import { useTimeRange } from "@phoenix/contexts/TimeRangeContext";
import { useTimeSlice } from "@phoenix/contexts/TimeSliceContext";
import { MetricDefinition } from "@phoenix/store";
import { assertUnreachable } from "@phoenix/typeUtils";
import {
  getMetricDescriptionByMetricKey,
  getMetricShortNameByMetricKey,
} from "@phoenix/utils/metricFormatUtils";
import { fullTimeFormatter } from "@phoenix/utils/timeFormatUtils";
import {
  calculateGranularity,
  calculateGranularityWithRollingAverage,
} from "@phoenix/utils/timeSeriesUtils";

import { MetricTimeSeriesQuery } from "./__generated__/MetricTimeSeriesQuery.graphql";

const numberFormatter = new Intl.NumberFormat([], {
  maximumFractionDigits: 2,
});

const useColors = () => {
  const colors = useChartColors();
  const color = colors.blue400;
  const barColor = colors.gray500;
  return {
    color,
    barColor,
  };
};

function TooltipContent({
  active,
  payload,
  label,
}: TooltipProps<number, string>) {
  const { color, barColor } = useColors();
  if (active && payload && payload.length) {
    const metricValue = payload[1]?.value ?? null;
    const count = payload[0]?.value ?? null;
    const metricString =
      typeof metricValue === "number"
        ? numberFormatter.format(metricValue)
        : "--";
    const predictionCountString =
      typeof count === "number" ? numberFormatter.format(count) : "--";
    return (
      <ChartTooltip>
        <Text weight="heavy" textSize="medium">{`${fullTimeFormatter(
          new Date(label)
        )}`}</Text>
        <ChartTooltipItem
          color={color}
          name={payload[1]?.payload.metricName ?? "Metric"}
          value={metricString}
        />
        <ChartTooltipItem
          color={barColor}
          shape="square"
          name="Count"
          value={predictionCountString}
        />
        <ChartTooltipDivider />
        <div
          css={css`
            display: flex;
            flex-direction: row;
            align-items: center;
            color: var(--ac-global-color-primary);
            gap: var(--px-spacing-sm);

            margin-top: var(--px-spacing-sm);
          `}
        >
          <Icon svg={<InfoOutline />} />
          <span>Click to view the point cloud at this time</span>
        </div>
      </ChartTooltip>
    );
  }

  return null;
}

function getChartTitle(metric: MetricDefinition) {
  switch (metric.type) {
    case "drift":
      return "Embedding Drift";
    case "performance":
      return "Model Performance";
    case "dataQuality":
      return "Data Quality";
    case "retrieval":
      return "Query Distance";
    default:
      assertUnreachable(metric);
  }
}

function getMetricShortName(metric: MetricDefinition | null): string {
  if (!metric) {
    // Fallback to count
    return "Count";
  } else {
    const metricType = metric.type;
    switch (metricType) {
      case "drift":
        return getMetricShortNameByMetricKey(metric.metric);
      case "performance":
        return getMetricShortNameByMetricKey(metric.metric);
      case "dataQuality":
        // TODO make this more generic and don't assume avg
        return `${metric.dimension.name} avg`;
      case "retrieval":
        return getMetricShortNameByMetricKey(metric.metric);
      default:
        assertUnreachable(metricType);
    }
  }
}

function getMetricDescription(metric: MetricDefinition) {
  switch (metric.type) {
    case "drift":
      return getMetricDescriptionByMetricKey(metric.metric);
    case "performance":
      return getMetricDescriptionByMetricKey(metric.metric);
    case "dataQuality":
      return null;
    case "retrieval":
      return getMetricDescriptionByMetricKey(metric.metric);
    default:
      assertUnreachable(metric);
  }
}

export function MetricTimeSeries({
  embeddingDimensionId,
}: {
  embeddingDimensionId: string;
}) {
  const metric = usePointCloudContext((state) => state.metric);

  // Modality of the metric as boolean values
  const fetchDrift = metric.type === "drift";
  const fetchQueryDistance = metric.type === "retrieval";
  const fetchDataQuality = metric.type === "dataQuality";
  const fetchPerformance = metric.type === "performance";

  const { timeRange } = useTimeRange();
  const { selectedTimestamp, setSelectedTimestamp } = useTimeSlice();
  const granularity = calculateGranularity(timeRange);
  const data = useLazyLoadQuery<MetricTimeSeriesQuery>(
    graphql`
      query MetricTimeSeriesQuery(
        $embeddingDimensionId: GlobalID!
        $timeRange: TimeRange!
        $metricGranularity: Granularity!
        $countGranularity: Granularity!
        $fetchDrift: Boolean!
        $fetchQueryDistance: Boolean!
        $fetchDataQuality: Boolean!
        $dimensionId: GlobalID!
        $fetchPerformance: Boolean!
        $performanceMetric: PerformanceMetric!
      ) {
        embedding: node(id: $embeddingDimensionId) {
          id
          ... on EmbeddingDimension {
            euclideanDistanceTimeSeries: driftTimeSeries(
              metric: euclideanDistance
              timeRange: $timeRange
              granularity: $metricGranularity
            ) @include(if: $fetchDrift) {
              data {
                timestamp
                value
              }
            }
            retrievalMetricTimeSeries(
              metric: euclideanDistance
              timeRange: $timeRange
              granularity: $metricGranularity
            ) @include(if: $fetchQueryDistance) {
              data {
                timestamp
                value
              }
            }
            trafficTimeSeries: dataQualityTimeSeries(
              metric: count
              timeRange: $timeRange
              granularity: $countGranularity
            ) {
              data {
                timestamp
                value
              }
            }
          }
        }
        dimension: node(id: $dimensionId) @include(if: $fetchDataQuality) {
          ... on Dimension {
            name
            dataQualityTimeSeries(
              metric: mean
              timeRange: $timeRange
              granularity: $metricGranularity
            ) {
              data {
                timestamp
                value
              }
            }
          }
        }
        model {
          performanceTimeSeries(
            metric: { metric: $performanceMetric }
            timeRange: $timeRange
            granularity: $metricGranularity
          ) @include(if: $fetchPerformance) {
            data {
              timestamp
              value
            }
          }
        }
      }
    `,
    {
      embeddingDimensionId,
      timeRange: {
        start: timeRange.start.toISOString(),
        end: timeRange.end.toISOString(),
      },
      metricGranularity: calculateGranularityWithRollingAverage(timeRange),
      countGranularity: granularity,
      fetchDrift,
      fetchQueryDistance,
      fetchDataQuality,
      fetchPerformance,
      dimensionId:
        metric.type === "dataQuality"
          ? metric.dimension.id
          : embeddingDimensionId, // NEED to provide a placeholder id. This is super hacky but it works for now
      performanceMetric:
        metric.type === "performance" ? metric.metric : "accuracyScore", // Need a placeholder metric
    }
  );

  const timeTickFormatter = useTimeTickFormatter({
    samplingIntervalMinutes: granularity.samplingIntervalMinutes,
  });

  const onClick: CategoricalChartFunc = useCallback(
    (state) => {
      // Parse out the timestamp from the first chart
      const { activePayload } = state;
      if (activePayload != null && activePayload.length > 0) {
        const payload = activePayload[0].payload;
        setSelectedTimestamp(new Date(payload.timestamp));
      }
    },
    [setSelectedTimestamp]
  );

  const chartPrimaryRawData = getChartPrimaryData({ data, metric });
  const chartSecondaryRawData = getTrafficData(data);
  const trafficDataMap =
    chartSecondaryRawData.reduce(
      (acc, traffic) => {
        acc[traffic.timestamp] = traffic.value;
        return acc;
      },
      {} as Record<string, number | null>
    ) ?? {};

  const chartData = chartPrimaryRawData.map((d) => {
    const traffic = trafficDataMap[d.timestamp];
    return {
      ...d,
      traffic: traffic,
      timestamp: new Date(d.timestamp).getTime(),
    };
  });
  const metricShortName = getMetricShortName(metric);
  const metricDescription = getMetricDescription(metric);

  const { color, barColor } = useColors();
  return (
    <section
      css={css`
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        h3 {
          padding: var(--px-spacing-sm) var(--px-spacing-lg) 0
            var(--px-spacing-lg);
          flex: none;
          display: flex;
          flex-direction: row;
          align-items: center;
          gap: var(--px-spacing-sm);
        }
        & > div {
          flex: 1 1 auto;
          width: 100%;
          overflow: hidden;
        }
      `}
    >
      <Heading level={3}>
        {getChartTitle(metric)}
        {metricDescription != null ? (
          <ContextualHelp>
            <Heading level={4}>{metricShortName}</Heading>
            <Content>{metricDescription}</Content>
          </ContextualHelp>
        ) : null}
      </Heading>
      <div>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={chartData}
            margin={{ top: 25, right: 18, left: 18, bottom: 10 }}
            onClick={onClick}
          >
            <defs>
              <linearGradient id="colorUv" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.8} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="barColor" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={barColor} stopOpacity={0.3} />
                <stop offset="95%" stopColor={barColor} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              {...defaultTimeXAxisProps}
              tickFormatter={(x) => timeTickFormatter(new Date(x))}
              style={{ fill: "var(--ac-global-text-color-700)" }}
            />
            <YAxis
              stroke={theme.colors.gray200}
              label={{
                value: metricShortName,
                angle: -90,
                position: "insideLeft",
                style: {
                  textAnchor: "middle",
                  fill: "var(--ac-global-text-color-900)",
                },
              }}
              style={{ fill: "var(--ac-global-text-color-700)" }}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              label={{
                value: "Count",
                angle: 90,
                position: "insideRight",
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
            <Tooltip content={<TooltipContent />} />
            <Bar
              yAxisId="right"
              dataKey="traffic"
              fill="url(#barColor)"
              spacing={5}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={color}
              fillOpacity={1}
              fill="url(#colorUv)"
            />

            {selectedTimestamp != null ? (
              <ReferenceLine
                {...defaultSelectedTimestampReferenceLineProps}
                x={selectedTimestamp.getTime()}
              />
            ) : null}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

/**
 * Function that selects the primary data for the chart
 */
function getChartPrimaryData({
  data,
  metric,
}: {
  data: MetricTimeSeriesQuery["response"];
  metric: MetricDefinition;
}): { metricName: string; timestamp: string; value: number | null }[] {
  if (
    data.embedding.euclideanDistanceTimeSeries?.data != null &&
    data.embedding.euclideanDistanceTimeSeries.data.length > 0
  ) {
    return data.embedding.euclideanDistanceTimeSeries.data.map((d) => ({
      metricName: getMetricShortNameByMetricKey(metric.metric),
      ...d,
    }));
  }
  if (
    data.embedding.retrievalMetricTimeSeries?.data != null &&
    data.embedding.retrievalMetricTimeSeries.data.length > 0
  ) {
    return data.embedding.retrievalMetricTimeSeries.data.map((d) => ({
      metricName: getMetricShortNameByMetricKey(metric.metric),
      ...d,
    }));
  } else if (
    data.dimension &&
    data.dimension?.dataQualityTimeSeries?.data != null &&
    data.dimension.dataQualityTimeSeries.data.length > 0
  ) {
    const dimensionName = data.dimension.name || "unknown";
    return data.dimension.dataQualityTimeSeries.data.map((d) => ({
      metricName: `${dimensionName} avg`,
      ...d,
    }));
  } else if (
    data.model &&
    data.model.performanceTimeSeries?.data != null &&
    data.model.performanceTimeSeries.data.length > 0
  ) {
    return data.model.performanceTimeSeries.data.map((d) => ({
      metricName: getMetricShortNameByMetricKey(metric.metric),
      ...d,
    }));
  } else if (data.embedding.trafficTimeSeries?.data != null) {
    return data.embedding.trafficTimeSeries.data.map((d) => ({
      metricName: "Count",
      ...d,
    }));
  }
  return [];
}

/**
 * Function that selects the secondary traffic (count) data for the chart
 */
function getTrafficData(
  data: MetricTimeSeriesQuery["response"]
): { timestamp: string; value: number | null }[] {
  if (data.embedding.trafficTimeSeries?.data != null) {
    return [...data.embedding.trafficTimeSeries.data];
  }
  return [];
}
