import { useMemo } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";

import { useTimeRange } from "@phoenix/components/datetime";

import type {
  TimeBinScale,
  TraceCountDashboardBarChartQuery,
} from "./__generated__/TraceCountDashboardBarChartQuery.graphql";
import { DashboardBarChart } from "./DashboardBarChart";

export function TraceCountDashboardBarChart({
  projectId,
}: {
  projectId: string;
}) {
  const { timeRange } = useTimeRange();
  const utcOffsetMinutes = 0;
  const scale = useMemo(() => {
    const startTime = timeRange.start;
    let scale: TimeBinScale = "HOUR";
    if (startTime) {
      const endTime = timeRange.end || new Date();
      const duration = (endTime.getTime() - startTime.getTime()) / 1000; // in seconds
      if (duration > 60 * 60 * 24 * 365 * 5) {
        // 5 years
        scale = "YEAR";
      } else if (duration > 60 * 60 * 24 * 30 * 5) {
        // 5 months
        scale = "MONTH";
      } else if (duration > 60 * 60 * 24 * 7 * 5) {
        // 5 weeks
        scale = "WEEK";
      } else if (duration > 60 * 60 * 24 * 5) {
        // 5 days
        scale = "DAY";
      } else if (duration > 60 * 60 * 5) {
        // 5 hours
        scale = "HOUR";
      } else {
        scale = "MINUTE";
      }
    }
    return scale;
  }, [timeRange]);

  const data = useLazyLoadQuery<TraceCountDashboardBarChartQuery>(
    graphql`
      query TraceCountDashboardBarChartQuery(
        $projectId: ID!
        $timeRange: TimeRange!
        $timeBinConfig: TimeBinConfig!
      ) {
        project: node(id: $projectId) {
          ... on Project {
            traceCountTimeSeries(
              timeRange: $timeRange
              timeBinConfig: $timeBinConfig
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
  const chartData = (data.project.traceCountTimeSeries?.data ?? []).map(
    (datum) => ({
      timestamp: datum.timestamp,
      value: datum.value,
    })
  );
  return <DashboardBarChart data={chartData} />;
}
