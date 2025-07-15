import { useMemo } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";

import { useTimeRange } from "@phoenix/components/datetime";
import {
  ONE_DAY_SEC,
  ONE_HOUR_SEC,
  ONE_MONTH_SEC,
  ONE_WEEK_SEC,
  ONE_YEAR_SEC,
} from "@phoenix/constants/timeConstants";

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
  // Get the local timezone offset in minutes from UTC
  // Note: getTimezoneOffset() returns the offset in minutes that the timezone is behind UTC
  // For example, if you're in EST (UTC-5), it returns 300 (5 hours * 60 minutes)
  // Since we need the offset FROM UTC, we negate this value
  const utcOffsetMinutes = -new Date().getTimezoneOffset();
  const scale = useMemo(() => {
    const startTime = timeRange.start;
    let scale: TimeBinScale = "DAY";
    if (startTime) {
      const endTime = timeRange.end || new Date();
      const duration = (endTime.getTime() - startTime.getTime()) / 1000; // in seconds
      if (duration > 5 * ONE_YEAR_SEC) {
        scale = "YEAR";
      } else if (duration > 5 * ONE_MONTH_SEC) {
        scale = "MONTH";
      } else if (duration > 5 * ONE_WEEK_SEC) {
        scale = "WEEK";
      } else if (duration > 5 * ONE_DAY_SEC) {
        scale = "DAY";
      } else if (duration > 5 * ONE_HOUR_SEC) {
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
  return <DashboardBarChart data={chartData} scale={scale} />;
}
