import { graphql, useLazyLoadQuery } from "react-relay";

import { useTimeBinScale } from "@phoenix/hooks/useTimeBin";
import { useUTCOffsetMinutes } from "@phoenix/hooks/useUTCOffsetMinutes";

import type { SessionAnnotationScoreTimeSeriesQuery } from "./__generated__/SessionAnnotationScoreTimeSeriesQuery.graphql";
import { AnnotationScoreTimeSeriesChart } from "./AnnotationScoreTimeSeriesChart";
import type { ProjectMetricViewProps } from "./types";
import { useMetricQueryFetchOptions } from "./types";

export function SessionAnnotationScoreTimeSeries({
  projectId,
  timeRange,
  onTimeRangeSelected,
}: ProjectMetricViewProps) {
  const scale = useTimeBinScale({ timeRange });
  const utcOffsetMinutes = useUTCOffsetMinutes();

  const data = useLazyLoadQuery<SessionAnnotationScoreTimeSeriesQuery>(
    graphql`
      query SessionAnnotationScoreTimeSeriesQuery(
        $projectId: ID!
        $timeRange: TimeRange!
        $timeBinConfig: TimeBinConfig!
      ) {
        project: node(id: $projectId) {
          ... on Project {
            sessionAnnotationScoreTimeSeries(
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
      data={data.project.sessionAnnotationScoreTimeSeries?.data ?? []}
      names={data.project.sessionAnnotationScoreTimeSeries?.names ?? []}
      scale={scale}
      timeRange={timeRange}
      onTimeRangeSelected={onTimeRangeSelected}
    />
  );
}
