import { startTransition, Suspense, useState } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";

import {
  ConnectedTimeRangeControls,
  useTimeRange,
} from "@phoenix/components/datetime";
import { ErrorBoundary } from "@phoenix/components/exception";
import { usePreferencesContext } from "@phoenix/contexts/PreferencesContext";
import { useInterval } from "@phoenix/hooks/useInterval";
import { useOnTimestampAdvance } from "@phoenix/hooks/useOnTimestampAdvance";
import { EVALUATORS_LIVE_REFRESH_INTERVAL_MS } from "@phoenix/pages/project/constants";

import type { ServerEvaluatorsTimeRangeControlsQuery } from "./__generated__/ServerEvaluatorsTimeRangeControlsQuery.graphql";

/**
 * The Evaluators page's time range control strip: pan/zoom buttons around the
 * same live toggle the project page shows. While live, checks every few
 * seconds whether any project received new spans or evaluation results, and
 * calls `onAdvance` when one did. Shares the project page's live preference,
 * so pausing one pauses the other.
 */
export function ServerEvaluatorsTimeRangeControls({
  onAdvance,
}: {
  /** Called, in a transition, when new data has landed. */
  onAdvance: () => void;
}) {
  const disabledControls = (
    <ConnectedTimeRangeControls
      isLive={false}
      onIsLiveChange={() => {}}
      isLiveToggleDisabled
    />
  );
  // A failed poll takes down only the live toggle, not the page around it.
  return (
    <ErrorBoundary fallback={() => disabledControls}>
      <Suspense fallback={disabledControls}>
        <ServerEvaluatorsTimeRangeControlsContent onAdvance={onAdvance} />
      </Suspense>
    </ErrorBoundary>
  );
}

function ServerEvaluatorsTimeRangeControlsContent({
  onAdvance,
}: {
  onAdvance: () => void;
}) {
  const isLive = usePreferencesContext((state) => state.traceStreamingEnabled);
  const setIsLive = usePreferencesContext(
    (state) => state.setTraceStreamingEnabled
  );
  const { refreshLiveTimeRange } = useTimeRange();
  const [pollCount, setPollCount] = useState(0);
  const { projectsLastUpdatedAt } =
    useLazyLoadQuery<ServerEvaluatorsTimeRangeControlsQuery>(
      graphql`
        query ServerEvaluatorsTimeRangeControlsQuery {
          projectsLastUpdatedAt
        }
      `,
      {},
      { fetchKey: pollCount, fetchPolicy: "store-and-network" }
    );
  useInterval(
    () => {
      // The previous result stays up while the next one loads.
      startTransition(() => setPollCount((count) => count + 1));
    },
    isLive ? EVALUATORS_LIVE_REFRESH_INTERVAL_MS : null
  );
  // New data landed: slide a live time range forward and refresh the page,
  // keeping the current data up while it loads
  useOnTimestampAdvance(projectsLastUpdatedAt, () => {
    startTransition(() => {
      refreshLiveTimeRange();
      onAdvance();
    });
  });
  return (
    <ConnectedTimeRangeControls isLive={isLive} onIsLiveChange={setIsLive} />
  );
}
