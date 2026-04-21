import { useMemo } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";
import { useParams } from "react-router";
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";

import {
  useSemanticChartColors,
  useSequentialChartColors,
} from "@phoenix/components/chart";
import { useTimeRange } from "@phoenix/components/datetime";
import { useTimeBinScale } from "@phoenix/hooks/useTimeBin";
import { useUTCOffsetMinutes } from "@phoenix/hooks/useUTCOffsetMinutes";

import type { ProjectSpanCountSparklineQuery } from "./__generated__/ProjectSpanCountSparklineQuery.graphql";

export function ProjectSpanCountSparkline() {
  const { projectId } = useParams();
  const { timeRange } = useTimeRange();
  const scale = useTimeBinScale({ timeRange });
  const utcOffsetMinutes = useUTCOffsetMinutes();

  const data = useLazyLoadQuery<ProjectSpanCountSparklineQuery>(
    graphql`
      query ProjectSpanCountSparklineQuery(
        $projectId: ID!
        $timeRange: TimeRange!
        $timeBinConfig: TimeBinConfig!
      ) {
        project: node(id: $projectId) {
          ... on Project {
            traceCountByStatusTimeSeries(
              timeRange: $timeRange
              timeBinConfig: $timeBinConfig
            ) {
              data {
                timestamp
                okCount
                errorCount
              }
            }
          }
        }
      }
    `,
    {
      projectId: projectId as string,
      timeRange: {
        start: timeRange.start?.toISOString(),
        end: timeRange.end?.toISOString(),
      },
      timeBinConfig: {
        scale,
        utcOffsetMinutes,
      },
    },
    { fetchPolicy: "store-and-network" }
  );

  const chartData = useMemo(
    () =>
      (data.project.traceCountByStatusTimeSeries?.data ?? []).map((datum) => ({
        timestamp: new Date(datum.timestamp),
        ok: datum.okCount,
        error: datum.errorCount,
      })),
    [data.project.traceCountByStatusTimeSeries?.data]
  );

  const colors = useSequentialChartColors();
  const semanticColors = useSemanticChartColors();

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={chartData}
        margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
        barSize={6}
      >
        <XAxis dataKey="timestamp" hide />
        <YAxis hide />
        <Bar dataKey="error" stackId="a" fill={semanticColors.danger} />
        <Bar
          dataKey="ok"
          stackId="a"
          fill={colors.gray300}
          radius={[2, 2, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
