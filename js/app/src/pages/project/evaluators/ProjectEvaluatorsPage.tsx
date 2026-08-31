import { css } from "@emotion/react";
import { Suspense, useState } from "react";
import { Outlet, useLoaderData, useParams } from "react-router";
import invariant from "tiny-invariant";

import { Flex, Loading, Text, View } from "@phoenix/components";
import { useTimeRange } from "@phoenix/components/datetime";
import { ProjectEvaluatorsTableProvider } from "@phoenix/contexts/ProjectEvaluatorsTableContext";
import { useOwnedPreloadedQuery } from "@phoenix/hooks";
import type { projectEvaluatorsLoaderQuery } from "@phoenix/pages/project/evaluators/__generated__/projectEvaluatorsLoaderQuery.graphql";
import { AddProjectEvaluatorMenu } from "@phoenix/pages/project/evaluators/AddProjectEvaluatorMenu";
import { useProjectEvaluatorPaths } from "@phoenix/pages/project/evaluators/projectEvaluatorPaths";
import type { ProjectEvaluatorsLoaderData } from "@phoenix/pages/project/evaluators/projectEvaluatorsLoader";
import { projectEvaluatorsLoaderGQL } from "@phoenix/pages/project/evaluators/projectEvaluatorsLoader";
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
      <Suspense fallback={<Loading />}>
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
  // The route loader preloads the owner query (unfiltered, with the time
  // range resolved from the URL). Subsequent toolbar, live, or user-selected
  // changes refetch the pagination fragment in ProjectEvaluatorsTable without
  // reloading this query.
  const loaderData = useLoaderData<ProjectEvaluatorsLoaderData>();
  invariant(loaderData?.queryRef, "loaderData with a queryRef is required");
  // Frozen at mount: a loader revalidation must not re-key the table below.
  const [initialTimeRange] = useState(() => loaderData.timeRange);
  const data = useOwnedPreloadedQuery<projectEvaluatorsLoaderQuery>({
    query: projectEvaluatorsLoaderGQL,
    queryRef: loaderData.queryRef,
  });
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
        initialFilter=""
        initialTimeRange={initialTimeRange}
      />
    </>
  );
}
