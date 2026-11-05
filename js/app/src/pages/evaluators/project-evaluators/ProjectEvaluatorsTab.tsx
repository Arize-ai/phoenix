import { css } from "@emotion/react";
import type { SortingState } from "@tanstack/react-table";
import { Suspense, useState } from "react";
import { useSearchParams } from "react-router";

import { DebouncedSearch, Flex, View } from "@phoenix/components";
import { Skeleton } from "@phoenix/components/core/loading";
import {
  ConnectedTimeRangeSelector,
  TimeRangeProvider,
} from "@phoenix/components/datetime";
import { TopNavActions } from "@phoenix/components/nav";
import { TableSkeleton } from "@phoenix/components/table";
import { ProjectEvaluatorsTabTable } from "@phoenix/pages/evaluators/project-evaluators/ProjectEvaluatorsTabTable";
import {
  ServerEvaluationCharts,
  ServerEvaluationChartsSkeleton,
} from "@phoenix/pages/evaluators/project-evaluators/ServerEvaluationCharts";
import {
  ServerEvaluationQueueStrip,
  ServerEvaluationQueueStripSkeleton,
} from "@phoenix/pages/evaluators/project-evaluators/ServerEvaluationQueueStrip";
import { normalizePickedProjectIds } from "@phoenix/pages/evaluators/project-evaluators/serverProjectSeries";
import { ServerProjectsFilterButton } from "@phoenix/pages/evaluators/project-evaluators/ServerProjectsFilterButton";
import { SearchBarSkeleton } from "@phoenix/pages/evaluators/SearchBarSkeleton";
import { QueueStatsRefreshContext } from "@phoenix/pages/project/evaluators/ProjectEvaluatorQueueStats";

/** The projects picked to show, repeated once per project. */
const PROJECT_PARAM = "project";

const pageCSS = css`
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  min-height: 0;
`;

const tableScrollCSS = css`
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
`;

/**
 * The Evaluators page's Project evaluators tab: every project evaluator
 * running online, across all projects, with the queue they share.
 */
export function ProjectEvaluatorsTab() {
  return (
    <TimeRangeProvider>
      <ProjectEvaluatorsTabContent />
    </TimeRangeProvider>
  );
}

function ProjectEvaluatorsTabContent() {
  const [filter, setFilter] = useState("");
  // Bumped when something on this page changes the queue, so the strip and
  // the table refetch at once instead of on their next poll.
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = () => setRefreshKey((key) => key + 1);
  const [sorting, setSorting] = useState<SortingState>([
    { id: "queue", desc: true },
  ]);
  const [searchParams, setSearchParams] = useSearchParams();
  const pickedProjectIds = normalizePickedProjectIds(
    searchParams.getAll(PROJECT_PARAM)
  );
  const setPickedProjectIds = (projectIds: string[]) =>
    setSearchParams(
      (params) => {
        const next = new URLSearchParams(params);
        next.delete(PROJECT_PARAM);
        for (const projectId of normalizePickedProjectIds(projectIds)) {
          next.append(PROJECT_PARAM, projectId);
        }
        return next;
      },
      { replace: true }
    );
  return (
    <QueueStatsRefreshContext.Provider value={refresh}>
      <TopNavActions>
        <ConnectedTimeRangeSelector size="S" />
      </TopNavActions>
      <div css={pageCSS}>
        <ServerEvaluationQueueStrip
          refreshKey={refreshKey}
          onQueueCleared={refresh}
        />
        <Suspense fallback={<ServerEvaluationChartsSkeleton />}>
          <ServerEvaluationCharts
            fetchKey={refreshKey}
            pickedProjectIds={pickedProjectIds}
            onPickedProjectIdsChange={setPickedProjectIds}
          />
        </Suspense>
        <View padding="size-100" flex="none">
          <Flex direction="row" gap="size-100" alignItems="center">
            <DebouncedSearch
              aria-label="Search evaluators or projects"
              placeholder="Search evaluators or projects"
              defaultValue={filter}
              onChange={setFilter}
            />
            <Suspense fallback={null}>
              <ServerProjectsFilterButton
                pickedProjectIds={pickedProjectIds}
                onPickedProjectIdsChange={setPickedProjectIds}
                fetchKey={refreshKey}
              />
            </Suspense>
          </Flex>
        </View>
        <div css={tableScrollCSS}>
          <Suspense fallback={<TableSkeleton rowCount="fill" />}>
            <ProjectEvaluatorsTabTable
              filter={filter}
              projectIds={pickedProjectIds}
              fetchKey={refreshKey}
              sorting={sorting}
              onSortingChange={setSorting}
            />
          </Suspense>
        </div>
      </div>
    </QueueStatsRefreshContext.Provider>
  );
}

/**
 * The tab while the page loads, laid out as the loaded tab is: the queue
 * strip, the charts, the search bar with the projects filter, and the table.
 */
export function ProjectEvaluatorsTabSkeleton() {
  return (
    <>
      <TopNavActions>
        <Skeleton
          width="var(--global-dimension-size-2000)"
          height="var(--global-button-height-s)"
        />
      </TopNavActions>
      <div css={pageCSS}>
        <ServerEvaluationQueueStripSkeleton />
        <ServerEvaluationChartsSkeleton />
        <SearchBarSkeleton trailingControlWidth="calc(14 * var(--global-dimension-size-100))" />
        <div css={tableScrollCSS}>
          <TableSkeleton rowCount="fill" />
        </div>
      </div>
    </>
  );
}
