import { graphql, useLazyLoadQuery } from "react-relay";

import type { TraceCountDashboardBarChartQuery } from "./__generated__/TraceCountDashboardBarChartQuery.graphql";
import { DashboardBarChart } from "./DashboardBarChart";

export function TraceCountDashboardBarChart({
  projectId,
}: {
  projectId: string;
}) {
  const data = useLazyLoadQuery<TraceCountDashboardBarChartQuery>(
    graphql`
      query TraceCountDashboardBarChartQuery($projectId: ID!) {
        project: node(id: $projectId) {
          ... on Project {
            traceCountTimeSeries {
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
