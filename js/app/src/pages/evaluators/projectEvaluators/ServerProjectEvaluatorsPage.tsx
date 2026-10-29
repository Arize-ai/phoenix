import { css } from "@emotion/react";
import type { SortingState } from "@tanstack/react-table";
import { Suspense, useCallback, useRef, useState } from "react";

import { DebouncedSearch, Flex, View } from "@phoenix/components";
import { ChartPanelStripSkeleton } from "@phoenix/components/chart";
import {
  ConnectedTimeRangeSelector,
  TimeRangeProvider,
} from "@phoenix/components/datetime";
import { TopNavActions } from "@phoenix/components/nav";
import { TableSkeleton } from "@phoenix/components/table";
import { ServerEvaluationCharts } from "@phoenix/pages/evaluators/projectEvaluators/ServerEvaluationCharts";
import { ServerEvaluationQueueStrip } from "@phoenix/pages/evaluators/projectEvaluators/ServerEvaluationQueueStrip";
import {
  QUEUE_SHARE_SORTING,
  ServerProjectEvaluatorsTable,
} from "@phoenix/pages/evaluators/projectEvaluators/ServerProjectEvaluatorsTable";
import { QueueStatsRefreshContext } from "@phoenix/pages/project/evaluators/ProjectEvaluatorQueueStats";

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
export function ServerProjectEvaluatorsPage() {
  return (
    <TimeRangeProvider>
      <ServerProjectEvaluatorsPageContent />
    </TimeRangeProvider>
  );
}

function ServerProjectEvaluatorsPageContent() {
  const [filter, setFilter] = useState("");
  // Bumped when something on this page changes the queue, so the strip and
  // the table refetch at once instead of on their next poll.
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = useCallback(() => setRefreshKey((key) => key + 1), []);
  const [sorting, setSorting] = useState<SortingState>([
    { id: "queue", desc: true },
  ]);
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const showQueueDrivers = useCallback(() => {
    setSorting(QUEUE_SHARE_SORTING);
    tableScrollRef.current?.scrollTo({ top: 0 });
  }, []);
  return (
    <QueueStatsRefreshContext.Provider value={refresh}>
      <TopNavActions>
        <ConnectedTimeRangeSelector size="S" />
      </TopNavActions>
      <div css={pageCSS}>
        <ServerEvaluationQueueStrip
          refreshKey={refreshKey}
          onQueueCleared={refresh}
          onShowQueueDrivers={showQueueDrivers}
        />
        <Suspense fallback={<ChartPanelStripSkeleton />}>
          <ServerEvaluationCharts fetchKey={refreshKey} />
        </Suspense>
        <View padding="size-100" flex="none">
          <Flex direction="row" gap="size-100" alignItems="center">
            <DebouncedSearch
              aria-label="Search evaluators or projects"
              placeholder="Search evaluators or projects"
              defaultValue={filter}
              onChange={setFilter}
            />
          </Flex>
        </View>
        <div css={tableScrollCSS} ref={tableScrollRef}>
          <Suspense fallback={<TableSkeleton rowCount="fill" />}>
            <ServerProjectEvaluatorsTable
              filter={filter}
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
