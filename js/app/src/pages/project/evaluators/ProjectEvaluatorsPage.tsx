import { css } from "@emotion/react";
import { Suspense, useState } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";
import { Outlet, useParams } from "react-router";
import invariant from "tiny-invariant";

import { Flex, Skeleton, Text, View } from "@phoenix/components";
import { useTimeRange } from "@phoenix/components/datetime";
import { ProjectEvaluatorsTableProvider } from "@phoenix/contexts/ProjectEvaluatorsTableContext";
import type { ProjectEvaluatorsPageQuery } from "@phoenix/pages/project/evaluators/__generated__/ProjectEvaluatorsPageQuery.graphql";
import { AddProjectEvaluatorMenu } from "@phoenix/pages/project/evaluators/AddProjectEvaluatorMenu";
import { useProjectEvaluatorPaths } from "@phoenix/pages/project/evaluators/projectEvaluatorPaths";
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
      <Suspense fallback={<ProjectEvaluatorsPageSkeleton />}>
        <ProjectEvaluatorsTableProvider>
          <ProjectEvaluatorsPageContent
            projectId={projectId}
            filter={filter}
            onFilterChange={setFilter}
          />
        </ProjectEvaluatorsTableProvider>
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
  onFilterChange,
}: {
  projectId: string;
  filter: string;
  onFilterChange: (filter: string) => void;
}) {
  const { timeRangeISOStrings } = useTimeRange();
  // The owner query supplies the initial filter and range. Subsequent toolbar,
  // live, or user-selected changes refetch the pagination fragment in
  // ProjectEvaluatorsTable without reloading this query.
  const [initialFilter] = useState(() => filter.trim());
  const [initialTimeRange] = useState(() => timeRangeISOStrings);
  const data = useLazyLoadQuery<ProjectEvaluatorsPageQuery>(
    graphql`
      query ProjectEvaluatorsPageQuery(
        $projectId: ID!
        $filter: ProjectEvaluatorFilter
        $timeRange: TimeRange!
      ) {
        project: node(id: $projectId) {
          ... on Project {
            evaluatorCount
            ...ProjectEvaluatorsTable_project
              @arguments(filter: $filter, timeRange: $timeRange)
          }
        }
      }
    `,
    {
      projectId,
      filter: initialFilter ? { col: "name", value: initialFilter } : null,
      timeRange: initialTimeRange,
    },
    { fetchPolicy: "store-and-network" }
  );
  invariant(data.project, "project is required");
  const paths = useProjectEvaluatorPaths();
  const isEmptyState =
    (data.project.evaluatorCount ?? 0) === 0 && filter.trim().length === 0;
  return (
    <>
      {isEmptyState ? (
        <View
          padding="size-100"
          borderBottomWidth="thin"
          borderBottomColor="default"
          flex="none"
        >
          <Flex
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            gap="size-100"
          >
            <Text size="S" color="text-700">
              Evaluators read span inputs, outputs, retrieved documents, and
              tool calls, then return labels or scores you can filter, chart,
              and alert on.
            </Text>
            <AddProjectEvaluatorMenu
              size="M"
              creationPaths={paths.listCreation}
            />
          </Flex>
        </View>
      ) : (
        <ProjectEvaluatorsToolbar
          filter={filter}
          onFilterChange={onFilterChange}
        />
      )}
      <ProjectEvaluatorsTable
        project={data.project}
        projectId={projectId}
        filter={filter}
        timeRange={timeRangeISOStrings}
        initialFilter={initialFilter}
        initialTimeRange={initialTimeRange}
      />
    </>
  );
}

function ProjectEvaluatorsPageSkeleton() {
  return (
    <>
      <View
        padding="size-100"
        borderBottomWidth="thin"
        borderBottomColor="default"
        flex="none"
      >
        <Flex justifyContent="end">
          <Skeleton width={140} height={40} animation="wave" />
        </Flex>
      </View>
      <View padding="size-100">
        <Skeleton width="100%" height={180} animation="wave" />
      </View>
    </>
  );
}
