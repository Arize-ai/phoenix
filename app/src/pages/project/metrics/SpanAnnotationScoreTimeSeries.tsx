import { graphql, useLazyLoadQuery } from "react-relay";

import { useTimeBinScale } from "@phoenix/hooks/useTimeBin";
import { useUTCOffsetMinutes } from "@phoenix/hooks/useUTCOffsetMinutes";

import type { SpanAnnotationScoreTimeSeriesQuery } from "./__generated__/SpanAnnotationScoreTimeSeriesQuery.graphql";
import { AnnotationScoreTimeSeriesChart } from "./AnnotationScoreTimeSeriesChart";
import type { ProjectMetricViewProps } from "./types";
import { useMetricQueryFetchOptions } from "./types";

export function SpanAnnotationScoreTimeSeries({
  projectId,
  timeRange,
  onTimeRangeSelected,
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
    },
    useMetricQueryFetchOptions()
  );

  return (
    <AnnotationScoreTimeSeriesChart
      data={data.project.spanAnnotationScoreTimeSeries?.data ?? []}
      names={data.project.spanAnnotationScoreTimeSeries?.names ?? []}
      scale={scale}
      timeRange={timeRange}
      onTimeRangeSelected={onTimeRangeSelected}
    />
  );
}
