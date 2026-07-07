import { graphql, useLazyLoadQuery } from "react-relay";

import { useTimeBinScale } from "@phoenix/hooks/useTimeBin";
import { useUTCOffsetMinutes } from "@phoenix/hooks/useUTCOffsetMinutes";

import type { TraceAnnotationScoreTimeSeriesQuery } from "./__generated__/TraceAnnotationScoreTimeSeriesQuery.graphql";
import { AnnotationScoreTimeSeriesChart } from "./AnnotationScoreTimeSeriesChart";
import type { ProjectMetricViewProps } from "./types";
import { useMetricQueryFetchOptions } from "./types";

export function TraceAnnotationScoreTimeSeries({
  projectId,
  timeRange,
  onTimeRangeSelected,
}: ProjectMetricViewProps) {
  const scale = useTimeBinScale({ timeRange });
  const utcOffsetMinutes = useUTCOffsetMinutes();

  const data = useLazyLoadQuery<TraceAnnotationScoreTimeSeriesQuery>(
    graphql`
      query TraceAnnotationScoreTimeSeriesQuery(
        $projectId: ID!
        $timeRange: TimeRange!
        $timeBinConfig: TimeBinConfig!
      ) {
        project: node(id: $projectId) {
          ... on Project {
            traceAnnotationScoreTimeSeries(
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
      data={data.project.traceAnnotationScoreTimeSeries?.data ?? []}
      names={data.project.traceAnnotationScoreTimeSeries?.names ?? []}
      scale={scale}
      timeRange={timeRange}
      onTimeRangeSelected={onTimeRangeSelected}
    />
  );
}
