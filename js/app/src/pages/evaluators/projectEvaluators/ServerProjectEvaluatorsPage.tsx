import { css } from "@emotion/react";
import { Suspense, useCallback, useState } from "react";

import { DebouncedSearch, Flex, View } from "@phoenix/components";
import {
  ConnectedTimeRangeSelector,
  TimeRangeProvider,
} from "@phoenix/components/datetime";
import { TopNavActions } from "@phoenix/components/nav";
import { TableSkeleton } from "@phoenix/components/table";
import { ServerEvaluationQueueStrip } from "@phoenix/pages/evaluators/projectEvaluators/ServerEvaluationQueueStrip";
import { ServerProjectEvaluatorsTable } from "@phoenix/pages/evaluators/projectEvaluators/ServerProjectEvaluatorsTable";
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
        <View padding="size-100" flex="none">
          <Flex direction="row" gap="size-100" alignItems="center">
            <DebouncedSearch
              aria-label="Search by evaluator or project name"
              placeholder="Search by evaluator or project name"
              defaultValue={filter}
              onChange={setFilter}
            />
          </Flex>
        </View>
        <div css={tableScrollCSS}>
          <Suspense fallback={<TableSkeleton rowCount="fill" />}>
            <ServerProjectEvaluatorsTable
              filter={filter}
              fetchKey={refreshKey}
            />
          </Suspense>
        </div>
      </div>
    </QueueStatsRefreshContext.Provider>
  );
}
