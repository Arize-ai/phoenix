import { graphql, useLazyLoadQuery } from "react-relay";

import { useTimeRange } from "@phoenix/components/datetime";

import type { TraceCountDashboardBarChartQuery } from "./__generated__/TraceCountDashboardBarChartQuery.graphql";
import { DashboardBarChart } from "./DashboardBarChart";

export function TraceCountDashboardBarChart({
  projectId,
}: {
  projectId: string;
}) {
  const { timeRange } = useTimeRange();
  const data = useLazyLoadQuery<TraceCountDashboardBarChartQuery>(
    graphql`
      query TraceCountDashboardBarChartQuery(
        $projectId: ID!
        $timeRange: TimeRange!
      ) {
        project: node(id: $projectId) {
          ... on Project {
            traceCountTimeSeries(timeRange: $timeRange) {
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
