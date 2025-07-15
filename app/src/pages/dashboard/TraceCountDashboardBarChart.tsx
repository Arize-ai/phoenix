import { useMemo } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";

import { useTimeRange } from "@phoenix/components/datetime";

import type {
  TimeBinScale,
  TraceCountDashboardBarChartQuery,
} from "./__generated__/TraceCountDashboardBarChartQuery.graphql";
import { DashboardBarChart } from "./DashboardBarChart";

const YEAR = 60 * 60 * 24 * 365;
const MONTH = 60 * 60 * 24 * 30;
const WEEK = 60 * 60 * 24 * 7;
const DAY = 60 * 60 * 24;
const HOUR = 60 * 60;

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
      if (duration > 5 * YEAR) {
        scale = "YEAR";
      } else if (duration > 5 * MONTH) {
        scale = "MONTH";
      } else if (duration > 5 * WEEK) {
        scale = "WEEK";
      } else if (duration > 5 * DAY) {
        scale = "DAY";
      } else if (duration > 5 * HOUR) {
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
