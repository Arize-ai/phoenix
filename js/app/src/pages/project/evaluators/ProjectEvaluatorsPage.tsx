import { css } from "@emotion/react";
import { Suspense, useState } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";
import { Outlet, useParams } from "react-router";
import invariant from "tiny-invariant";

import { Skeleton, View } from "@phoenix/components";
import { useTimeRange } from "@phoenix/components/datetime";
import type { ProjectEvaluatorsPageQuery } from "@phoenix/pages/project/evaluators/__generated__/ProjectEvaluatorsPageQuery.graphql";
import { ProjectEvaluatorsTable } from "@phoenix/pages/project/evaluators/ProjectEvaluatorsTable";
import { ProjectEvaluatorsToolbar } from "@phoenix/pages/project/evaluators/ProjectEvaluatorsToolbar";

export function ProjectEvaluatorsPage() {
  const { projectId } = useParams();
  invariant(projectId, "projectId is required");
  const [filter, setFilter] = useState("");
  return (
    <main
      css={css`
        flex: 1 1 auto;
        display: flex;
        flex-direction: column;
        min-height: 0;
      `}
    >
      <ProjectEvaluatorsToolbar filter={filter} onFilterChange={setFilter} />
      <Suspense fallback={<ProjectEvaluatorsPageSkeleton />}>
        <ProjectEvaluatorsPageContent projectId={projectId} filter={filter} />
      </Suspense>
      {/* The create and edit slideovers, each on its own nested route. The
          copy and attach routes suspend while loading the evaluator they are
          seeded from; the list stays interactive until the slideover opens. */}
      <Suspense fallback={null}>
        <Outlet />
      </Suspense>
    </main>
  );
}

function ProjectEvaluatorsPageContent({
  projectId,
  filter,
}: {
  projectId: string;
  filter: string;
}) {
  const { timeRangeISOStrings } = useTimeRange();
  // The owner query supplies the initial range. Subsequent live or user-selected
  // range changes refetch the pagination fragment in ProjectEvaluatorsTable,
  // matching the spans and traces table pattern without reloading this query.
  const [initialTimeRange] = useState(() => timeRangeISOStrings);
  const data = useLazyLoadQuery<ProjectEvaluatorsPageQuery>(
    graphql`
      query ProjectEvaluatorsPageQuery(
        $projectId: ID!
        $timeRange: TimeRange!
      ) {
        project: node(id: $projectId) {
          ... on Project {
            ...ProjectEvaluatorsTable_project @arguments(timeRange: $timeRange)
          }
        }
      }
    `,
    { projectId, timeRange: initialTimeRange },
    { fetchPolicy: "store-and-network" }
  );
  invariant(data.project, "project is required");
  return (
    <ProjectEvaluatorsTable
      project={data.project}
      projectId={projectId}
      filter={filter}
      timeRange={timeRangeISOStrings}
    />
  );
}

function ProjectEvaluatorsPageSkeleton() {
  return (
    <>
      <View padding="size-100">
        <Skeleton width="100%" height={180} animation="wave" />
      </View>
    </>
  );
}
