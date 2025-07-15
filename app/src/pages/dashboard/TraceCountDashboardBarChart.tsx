import { useMemo } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";

import { useTimeRange } from "@phoenix/components/datetime";

import type { TimeBinScale,TraceCountDashboardBarChartQuery } from "./__generated__/TraceCountDashboardBarChartQuery.graphql";
import { DashboardBarChart } from "./DashboardBarChart";

export function TraceCountDashboardBarChart({
  projectId,
}: {
  projectId: string;
}) {
  const { timeRange } = useTimeRange();
<<<<<<< Updated upstream
  const { start, end } = useMemo(() => {
    return {
      start: timeRange?.start?.toISOString(),
      end: timeRange?.end?.toISOString(),
    };
  }, [timeRange]);
=======
  const { start, end, scale } = useMemo(() => {
    // console.log(`timeRange.start: ${timeRange.start}`);
    console.log(`timeRange.end: ${timeRange.end}`);
    const startTime = timeRange.start;
    const endTime = timeRange.end || new Date();
    let scale: TimeBinScale = "HOUR";
    if (startTime) {
      const duration = endTime.getTime() - startTime.getTime();
      if (duration > 1000 * 60 * 60 * 24 * 365 * 5) { // 5 years
        scale = "YEAR";
      } else if (duration > 1000 * 60 * 60 * 24 * 30 * 5) { // 5 months
        scale = "MONTH";
      } else if (duration > 1000 * 60 * 60 * 24 * 7 * 5) { // 5 weeks
        scale = "WEEK";
      } else if (duration > 1000 * 60 * 60 * 24 * 5) { // 5 days
        scale = "DAY";
      } else if (duration > 1000 * 60 * 60 * 5) { // 5 hours
        scale = "HOUR";
      } else {
        scale = "MINUTE";
      }
    }
    return {
      start: startTime?.toISOString(),
      end: endTime.toISOString(),
      scale,
    };
  }, [timeRange.start, timeRange.end]);
>>>>>>> Stashed changes

  const data = useLazyLoadQuery<TraceCountDashboardBarChartQuery>(
    graphql`
      query TraceCountDashboardBarChartQuery(
        $projectId: ID!
        $timeRange: TimeRange!
        $timeBinConfig: TimeBinConfig!
      ) {
        project: node(id: $projectId) {
          ... on Project {
            traceCountTimeSeries(timeRange: $timeRange, timeBinConfig: $timeBinConfig) {
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
        start,
        end,
<<<<<<< Updated upstream
=======
      },
      timeBinConfig: {
        scale,
>>>>>>> Stashed changes
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
