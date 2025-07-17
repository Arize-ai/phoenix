import { graphql, useLazyLoadQuery } from "react-relay";

import { useTimeRange } from "@phoenix/components/datetime";
import { useTimeBinScale } from "@phoenix/hooks/useTimeBin";
import { useUTCOffsetMinutes } from "@phoenix/hooks/useUTCOffsetMinutes";

import type { TraceCountDashboardBarChartQuery } from "./__generated__/TraceCountDashboardBarChartQuery.graphql";
import { DashboardBarChart } from "./DashboardBarChart";

export function TraceCountDashboardBarChart({
  projectId,
}: {
  projectId: string;
}) {
  const { timeRange } = useTimeRange();
  const scale = useTimeBinScale({ timeRange });
  const utcOffsetMinutes = useUTCOffsetMinutes();

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
