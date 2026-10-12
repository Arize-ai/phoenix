import { css } from "@emotion/react";
import { Suspense, useCallback, useState } from "react";
import { Group, Panel } from "react-resizable-panels";
import { Outlet, useLoaderData, useParams } from "react-router";
import invariant from "tiny-invariant";

import { Flex, Loading, Text, View } from "@phoenix/components";
import { useTimeRange } from "@phoenix/components/datetime";
import { EVALUATOR_FILTER_PARAM } from "@phoenix/constants/searchParams";
import { ProjectEvaluatorsTableProvider } from "@phoenix/contexts/ProjectEvaluatorsTableContext";
import { useFilterSearchParam, useOwnedPreloadedQuery } from "@phoenix/hooks";
import type { projectEvaluatorsLoaderQuery } from "@phoenix/pages/project/evaluators/__generated__/projectEvaluatorsLoaderQuery.graphql";
import { AddProjectEvaluatorMenu } from "@phoenix/pages/project/evaluators/AddProjectEvaluatorMenu";
import { ClearQueuedEvaluationsButton } from "@phoenix/pages/project/evaluators/ClearQueuedEvaluationsButton";
import {
  ProjectEvaluatorQueueAside,
  QueueStatsRefreshContext,
} from "@phoenix/pages/project/evaluators/ProjectEvaluatorQueueStats";
import type { ProjectEvaluatorSelection } from "@phoenix/pages/project/evaluators/projectEvaluatorSelection";
import type { ProjectEvaluatorsLoaderData } from "@phoenix/pages/project/evaluators/projectEvaluatorsLoader";
import { projectEvaluatorsLoaderGQL } from "@phoenix/pages/project/evaluators/projectEvaluatorsLoader";
import { ProjectEvaluatorsTable } from "@phoenix/pages/project/evaluators/ProjectEvaluatorsTable";
import { ProjectEvaluatorsToolbar } from "@phoenix/pages/project/evaluators/ProjectEvaluatorsToolbar";
import {
  TableAsidePanel,
  TableAsideToggleButton,
} from "@phoenix/pages/project/TableAside";

const QUEUE_ASIDE_DEFAULT_SIZE_PIXELS = 280;
const QUEUE_ASIDE_MIN_SIZE_PIXELS = 240;
const QUEUE_ASIDE_MAX_SIZE_PIXELS = 480;

/** Fills the rest of the tab below the toolbar, so the group can size its panels. */
const tableGroupCSS = css`
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
`;

/** The table scrolls inside its panel rather than growing the panel. */
const tablePanelCSS = css`
  height: 100%;
  display: flex;
  flex-direction: column;
  min-height: 0;
`;

export function ProjectEvaluatorsPage() {
  const { projectId } = useParams();
  invariant(projectId, "projectId is required");
  const [urlFilter, setUrlFilter] = useFilterSearchParam(
    EVALUATOR_FILTER_PARAM
  );
  // One debounced onChange feeds both: the raw text drives the table while
  // the hook lands the trimmed value in the URL. Seeded from the URL so a
  // shared or reloaded link restores the search; the route loader preloads
  // the first page with the same param.
  const [filter, setFilter] = useState(urlFilter);
  // Page-owned so selected rows survive table filtering and refetches while
  // the floating selection toolbar is active.
  const [selection, setSelection] = useState<ProjectEvaluatorSelection>({});
  const handleFilterChange = useCallback(
    (nextFilter: string) => {
      setFilter(nextFilter);
      setUrlFilter(nextFilter);
    },
    [setUrlFilter]
  );
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
            onFilterChange={handleFilterChange}
            selection={selection}
            onSelectionChange={setSelection}
          />
        </ProjectEvaluatorsTableProvider>
      </Suspense>
      {/* The gallery modal and the create and edit slideovers, each on its
          own nested route. The copy and attach routes suspend while loading
          the evaluator they are seeded from; the list stays interactive until
          the slideover opens. */}
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
  selection,
  onSelectionChange,
}: {
  projectId: string;
  filter: string;
  onFilterChange: (filter: string) => void;
  selection: ProjectEvaluatorSelection;
  onSelectionChange: (selection: ProjectEvaluatorSelection) => void;
}) {
  const { timeRangeISOStrings } = useTimeRange();
  // The route loader preloads the owner query (with the filter and time
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
  const isEmptyState =
    (data.project.evaluatorCount ?? 0) === 0 && filter.trim().length === 0;
  // Bumped when something on this page changes the queue, so the queue stats
  // refetch at once instead of on their next poll.
  const [queueRefreshKey, setQueueRefreshKey] = useState(0);
  const refreshQueueStats = useCallback(
    () => setQueueRefreshKey((key) => key + 1),
    []
  );
  return (
    <QueueStatsRefreshContext.Provider value={refreshQueueStats}>
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
            <Flex
              direction="row"
              alignItems="center"
              gap="size-100"
              flex="none"
            >
              <AddProjectEvaluatorMenu size="M" />
              <TableAsideToggleButton />
            </Flex>
          </Flex>
        </View>
      ) : (
        <ProjectEvaluatorsToolbar
          filter={filter}
          onFilterChange={onFilterChange}
        />
      )}
      {/* The table and its queue aside share the rest of the tab, like the
          spans, traces and sessions tables and theirs. */}
      <div css={tableGroupCSS}>
        <Group orientation="horizontal">
          <Panel id="evaluators-table" minSize="30%">
            <div css={tablePanelCSS}>
              <ProjectEvaluatorsTable
                project={data.project}
                projectId={projectId}
                filter={filter}
                timeRange={timeRangeISOStrings}
                initialFilter={loaderData.filter}
                initialTimeRange={initialTimeRange}
                initialScoreWindow={loaderData.scoreWindow}
                initialIncludeMeanScore={loaderData.includeMeanScore}
                selection={selection}
                onSelectionChange={onSelectionChange}
              />
            </div>
          </Panel>
          {/* Narrower than the spans and sessions asides: a few counts and a
              bar, no copyable fields or annotation summaries. */}
          <TableAsidePanel
            defaultSize={QUEUE_ASIDE_DEFAULT_SIZE_PIXELS}
            minSize={QUEUE_ASIDE_MIN_SIZE_PIXELS}
            maxSize={QUEUE_ASIDE_MAX_SIZE_PIXELS}
          >
            <ProjectEvaluatorQueueAside
              projectId={projectId}
              refreshKey={queueRefreshKey}
              action={(clearableCount) => (
                <ClearQueuedEvaluationsButton
                  projectId={projectId}
                  isProjectQueueEmpty={clearableCount === 0}
                />
              )}
            />
          </TableAsidePanel>
        </Group>
      </div>
    </QueueStatsRefreshContext.Provider>
  );
}
