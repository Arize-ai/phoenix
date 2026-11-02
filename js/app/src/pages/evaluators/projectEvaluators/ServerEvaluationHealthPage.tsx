import { css } from "@emotion/react";
import { Suspense, useState } from "react";

import { Flex, Heading, View } from "@phoenix/components";
import { ChartPanelStripSkeleton } from "@phoenix/components/chart";
import {
  ConnectedTimeRangeSelector,
  TimeRangeProvider,
} from "@phoenix/components/datetime";
import { TopNavActions } from "@phoenix/components/nav";
import { ServerEvaluationCharts } from "@phoenix/pages/evaluators/projectEvaluators/ServerEvaluationCharts";
import { ServerProjectsFilterButton } from "@phoenix/pages/evaluators/projectEvaluators/ServerProjectsFilterButton";
import { useServerPickedProjectIds } from "@phoenix/pages/evaluators/projectEvaluators/useServerPickedProjectIds";

const pageCSS = css`
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
`;

/**
 * The health of online evaluation across the server: the shared queue's size,
 * what entered and left it, and which projects used it most.
 */
export function ServerEvaluationHealthPage() {
  return (
    <TimeRangeProvider>
      <ServerEvaluationHealthPageContent />
    </TimeRangeProvider>
  );
}

function ServerEvaluationHealthPageContent() {
  const [fetchKey] = useState(0);
  const { pickedProjectIds, setPickedProjectIds } = useServerPickedProjectIds();
  return (
    <main css={pageCSS}>
      <TopNavActions>
        <ConnectedTimeRangeSelector size="S" />
      </TopNavActions>
      <View padding="size-200">
        <Flex direction="column" gap="size-200">
          <Flex
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            gap="size-100"
          >
            <Heading level={2} weight="heavy">
              Online evaluation health
            </Heading>
            <Suspense fallback={null}>
              <ServerProjectsFilterButton
                pickedProjectIds={pickedProjectIds}
                onPickedProjectIdsChange={setPickedProjectIds}
                fetchKey={fetchKey}
              />
            </Suspense>
          </Flex>
          <Suspense fallback={<ChartPanelStripSkeleton />}>
            <ServerEvaluationCharts
              fetchKey={fetchKey}
              pickedProjectIds={pickedProjectIds}
              onPickedProjectIdsChange={setPickedProjectIds}
            />
          </Suspense>
        </Flex>
      </View>
    </main>
  );
}
