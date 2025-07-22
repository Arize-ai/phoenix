import { graphql, useLazyLoadQuery } from "react-relay";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  TooltipContentProps,
  XAxis,
  YAxis,
} from "recharts";

import { Text } from "@phoenix/components";
import {
  ChartTooltip,
  ChartTooltipItem,
  useChartColors,
  useTimeTickFormatter,
} from "@phoenix/components/chart";
import {
  defaultCartesianGridProps,
  defaultXAxisProps,
  defaultYAxisProps,
} from "@phoenix/components/chart/defaults";
import { useTimeRange } from "@phoenix/components/datetime";
import { useTimeBinScale } from "@phoenix/hooks/useTimeBin";
import { useUTCOffsetMinutes } from "@phoenix/hooks/useUTCOffsetMinutes";
import { fullTimeFormatter } from "@phoenix/utils/timeFormatUtils";

import type { SpanAnnotationScoreTimeSeriesQuery } from "./__generated__/SpanAnnotationScoreTimeSeriesQuery.graphql";

function TooltipContent({
  active,
  payload,
  label,
}: TooltipContentProps<number, string>) {
  const chartColors = useChartColors();
  if (active && payload && payload.length) {
    return (
      <ChartTooltip>
        {label && (
          <Text weight="heavy" size="S">{`${fullTimeFormatter(
            new Date(label)
          )}`}</Text>
        )}
        {payload.map(
          (
            entry: {
              value?: number;
              color?: string;
              dataKey?: string | number;
            },
            index: number
          ) => {
            if (!entry.value) return null;
            return (
              <ChartTooltipItem
                key={index}
                color={entry.color || chartColors.default}
                shape="line"
                name={String(entry.dataKey || "unknown")}
                value={entry.value.toFixed(2)}
              />
            );
          }
        )}
      </ChartTooltip>
    );
  }

  return null;
}

export function SpanAnnotationScoreTimeSeries({
  projectId,
}: {
  projectId: string;
}) {
  const { timeRange } = useTimeRange();
  const scale = useTimeBinScale({ timeRange });
  const utcOffsetMinutes = useUTCOffsetMinutes();

  const data = useLazyLoadQuery<SpanAnnotationScoreTimeSeriesQuery>(
    graphql`
      query SpanAnnotationScoreTimeSeriesQuery(
        $projectId: ID!
        $timeRange: TimeRange!
        $timeBinConfig: TimeBinConfig!
      ) {
        project: node(id: $projectId) {
          ... on Project {
            spanAnnotationScoreTimeSeries(
              timeRange: $timeRange
              timeBinConfig: $timeBinConfig
            ) {
              data {
                timestamp
                scoresWithLabels {
                  label
                  score
                }
              }
              names
            }
          }
        }
      }
    `,
    {
      projectId,
      timeRange: {
        start: timeRange.start?.toISOString(),
        end: timeRange.end?.toISOString(),
      },
      timeBinConfig: {
        scale,
        utcOffsetMinutes,
      },
    }
  );

  const timeSeriesData = data.project.spanAnnotationScoreTimeSeries?.data ?? [];
  const annotationNames =
    data.project.spanAnnotationScoreTimeSeries?.names ?? [];

  // Transform the data to have one property per annotation label
  const chartData = timeSeriesData.map((datum) => {
    const transformed: Record<string, string | number> = {
      timestamp: datum.timestamp,
    };

    datum.scoresWithLabels.forEach((scoreWithLabel) => {
      transformed[scoreWithLabel.label] = scoreWithLabel.score;
    });

    return transformed;
  });

  const timeTickFormatter = useTimeTickFormatter({
    samplingIntervalMinutes: (() => {
      switch (scale) {
        case "MINUTE":
          return 1;
        case "HOUR":
          return 60;
        default:
          return 60 * 24;
      }
    })(),
  });

  const colors = useChartColors();
  const colorMap = [
    colors.blue400,
    colors.orange400,
    colors.red400,
    colors.purple400,
    colors.gray600,
    colors.gray700,
  ];

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart
        data={chartData}
        margin={{ top: 0, right: 18, left: 0, bottom: 0 }}
      >
        <XAxis
          dataKey="timestamp"
          tickFormatter={(x) => timeTickFormatter(new Date(x))}
          {...defaultXAxisProps}
        />
        <YAxis
          width={50}
          label={{
            value: "Score",
            angle: -90,
            dx: -10,
            style: {
              textAnchor: "middle",
              fill: "var(--chart-axis-label-color)",
            },
          }}
          {...defaultYAxisProps}
        />

        <CartesianGrid vertical={false} {...defaultCartesianGridProps} />
        <Tooltip
          content={TooltipContent}
          cursor={{ fill: "var(--chart-tooltip-cursor-fill-color)" }}
        />

        {annotationNames.map((name, index) => (
          <Line
            key={name}
            type="monotone"
            dataKey={name}
            stroke={colorMap[index % colorMap.length]}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
            name={name}
          />
        ))}

        <Legend align="left" iconType="line" iconSize={8} />
      </LineChart>
    </ResponsiveContainer>
  );
}
