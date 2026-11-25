import { css } from "@emotion/react";
import type { SortingState } from "@tanstack/react-table";
import { Suspense, useState } from "react";

import { Alert, DebouncedSearch, Flex, View } from "@phoenix/components";
import {
  CHART_PANEL_STRIP_DEFAULT_HEIGHT_PIXELS,
  ChartPanelStripSkeleton,
} from "@phoenix/components/chart";
import { Skeleton } from "@phoenix/components/core/loading";
import {
  ConnectedTimeRangeSelector,
  TimeRangeProvider,
  useTimeRange,
  useTimeRangeSelectionKey,
} from "@phoenix/components/datetime";
import { ErrorBoundary } from "@phoenix/components/exception";
import { TopNavActions } from "@phoenix/components/nav";
import { TableSkeleton } from "@phoenix/components/table";
import { usePreferencesContext } from "@phoenix/contexts/PreferencesContext";
import { ProjectEvaluatorsTabTable } from "@phoenix/pages/evaluators/project-evaluators/ProjectEvaluatorsTabTable";
import {
  ServerEvaluationChartsPanelGroup,
  ServerEvaluationChartsSelector,
} from "@phoenix/pages/evaluators/project-evaluators/ServerEvaluationCharts";
import { ServerEvaluationQueueStrip } from "@phoenix/pages/evaluators/project-evaluators/ServerEvaluationQueueStrip";
import { ServerEvaluatorsTimeRangeControls } from "@phoenix/pages/evaluators/project-evaluators/ServerEvaluatorsTimeRangeControls";
import { useServerEvaluatorsRefreshKey } from "@phoenix/pages/evaluators/project-evaluators/useServerEvaluatorsRefreshKey";
import { SearchBarSkeleton } from "@phoenix/pages/evaluators/SearchBarSkeleton";
import { useQueueStatsPoll } from "@phoenix/pages/project/evaluators/evaluationQueueStatParts";
import { EvaluationQueueStripSkeleton } from "@phoenix/pages/project/evaluators/EvaluationQueueStrip";
import { QueueStatsRefreshContext } from "@phoenix/pages/project/evaluators/ProjectEvaluatorQueueStats";

const pageCSS = css`
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  min-height: 0;
`;

/** The space below the queue strip, shared by the charts and the table. */
const chartsAndTableCSS = css`
  flex: 1 1 auto;
  min-height: 0;
`;

const tableContentCSS = css`
  display: flex;
  flex-direction: column;
  height: 100%;
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
  const { refreshKey, refresh } = useServerEvaluatorsRefreshKey();
  const { timeRangeISOStrings } = useTimeRange();
  const timeRangeSelectionKey = useTimeRangeSelectionKey();
  const isLive = usePreferencesContext(
    (state) => state.serverEvaluatorsStreamingEnabled
  );
  // One poll keeps the strip and the charts in step, while the page is live.
  const { fetchKey } = useQueueStatsPoll({
    refreshKey,
    isPolling: isLive,
  });
  const [sorting, setSorting] = useState<SortingState>([
    { id: "queue", desc: true },
  ]);
  return (
    <QueueStatsRefreshContext.Provider value={refresh}>
      <TopNavActions>
        <ConnectedTimeRangeSelector size="S" />
      </TopNavActions>
      <TopNavActions order={1}>
        <ServerEvaluatorsTimeRangeControls onNewData={refresh} />
      </TopNavActions>
      <div css={pageCSS}>
        <ServerEvaluationQueueStrip
          fetchKey={fetchKey}
          onQueueCleared={refresh}
        />
        <div css={chartsAndTableCSS}>
          <ServerEvaluationChartsPanelGroup fetchKey={fetchKey}>
            <div css={tableContentCSS}>
              <View padding="size-100" flex="none">
                <Flex direction="row" gap="size-100" alignItems="center">
                  <DebouncedSearch
                    aria-label="Search evaluators or projects"
                    placeholder="Search evaluators or projects"
                    defaultValue={filter}
                    onChange={setFilter}
                  />
                  <ServerEvaluationChartsSelector />
                </Flex>
              </View>
              <div css={tableScrollCSS}>
                <ErrorBoundary
                  resetKey={`${refreshKey} ${timeRangeISOStrings.start} ${timeRangeISOStrings.end}`}
                  fallback={() => (
                    <View padding="size-200">
                      <Alert variant="danger">
                        Couldn't load the evaluators
                      </Alert>
                    </View>
                  )}
                >
                  <Suspense
                    key={timeRangeSelectionKey}
                    fallback={<TableSkeleton rowCount="fill" />}
                  >
                    <ProjectEvaluatorsTabTable
                      filter={filter}
                      fetchKey={refreshKey}
                      sorting={sorting}
                      onSortingChange={setSorting}
                      onEvaluatorsDeleted={refresh}
                    />
                  </Suspense>
                </ErrorBoundary>
              </div>
            </div>
          </ServerEvaluationChartsPanelGroup>
        </div>
      </div>
    </QueueStatsRefreshContext.Provider>
  );
}

/**
 * The tab while the page loads, laid out as the loaded tab is: the queue
 * strip, the charts, the search bar with the chart picker, and the table.
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
        <EvaluationQueueStripSkeleton />
        <View
          height={CHART_PANEL_STRIP_DEFAULT_HEIGHT_PIXELS}
          paddingStart="size-200"
          paddingEnd="size-200"
          paddingTop="size-100"
          flex="none"
        >
          <ChartPanelStripSkeleton />
        </View>
        <SearchBarSkeleton trailingControlWidth="calc(11 * var(--global-dimension-size-100))" />
        <div css={tableScrollCSS}>
          <TableSkeleton rowCount="fill" />
        </div>
      </div>
    </>
  );
}
