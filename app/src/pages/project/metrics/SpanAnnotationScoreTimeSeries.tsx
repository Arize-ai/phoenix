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
  useBinInterval,
  useBinTimeTickFormatter,
} from "@phoenix/components/chart";
import {
  defaultCartesianGridProps,
  defaultLegendProps,
  defaultXAxisProps,
  defaultYAxisProps,
} from "@phoenix/components/chart/defaults";
import { useTimeBinScale } from "@phoenix/hooks/useTimeBin";
import { useTimeFormatters } from "@phoenix/hooks/useTimeFormatters";
import { useUTCOffsetMinutes } from "@phoenix/hooks/useUTCOffsetMinutes";
import { useWordColor } from "@phoenix/hooks/useWordColor";
import { formatFloat } from "@phoenix/utils/numberFormatUtils";

import type { SpanAnnotationScoreTimeSeriesQuery } from "./__generated__/SpanAnnotationScoreTimeSeriesQuery.graphql";
import type { ProjectMetricViewProps } from "./types";

function TooltipContent({
  active,
  payload,
  label,
}: TooltipContentProps<number, string>) {
  const { fullTimeFormatter } = useTimeFormatters();
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
                color={entry.color || "#FF00FF"} // hot pink, fail loudly.
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

function AnnotationLine({ name }: { name: string }) {
  const color = useWordColor(name);
  return (
    <Line
      type="monotone"
      dataKey={name}
      stroke={color}
      strokeWidth={2}
      dot={{ r: 2 }}
      activeDot={{ r: 4 }}
      name={name}
    />
  );
}

export function SpanAnnotationScoreTimeSeries({
  projectId,
  timeRange,
}: ProjectMetricViewProps) {
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
    const transformed: Record<string, string | number | Date> = {
      timestamp: new Date(datum.timestamp),
    };

    datum.scoresWithLabels.forEach((scoreWithLabel) => {
      transformed[scoreWithLabel.label] = scoreWithLabel.score;
    });

    return transformed;
  });

  const timeTickFormatter = useBinTimeTickFormatter({ scale });
  const interval = useBinInterval({ scale });

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart
        data={chartData}
        margin={{ top: 0, right: 18, left: 0, bottom: 0 }}
        syncId={"projectMetrics"}
      >
        <XAxis
          {...defaultXAxisProps}
          dataKey="timestamp"
          tickFormatter={(x) => timeTickFormatter(x)}
          interval={interval}
        />
        <YAxis
          width={55}
          tickFormatter={(x) => formatFloat(x)}
          label={{
            value: "Score",
            angle: -90,
            dx: -20,
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

        {annotationNames.map((name) => {
          return <AnnotationLine key={name} name={name} />;
        })}

        <Legend {...defaultLegendProps} iconType="line" iconSize={8} />
      </LineChart>
    </ResponsiveContainer>
  );
}
