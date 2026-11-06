import { startTransition } from "react";
import { graphql, useRefetchableFragment } from "react-relay";
import { useParams } from "react-router";

import { ConnectedTimeRangeControls } from "@phoenix/components/datetime";
import { useStreamState } from "@phoenix/contexts/StreamStateContext";
import { useInterval } from "@phoenix/hooks/useInterval";
import { useOnLastUpdatedAtAdvance } from "@phoenix/hooks/useOnLastUpdatedAtAdvance";
import { useProjectRootPath } from "@phoenix/hooks/useProjectRootPath";
import { EVALUATORS_LIVE_REFRESH_INTERVAL_MS } from "@phoenix/pages/project/constants";
import { useSelectedTraceSlots } from "@phoenix/pages/project/useSelectedTraceSlots";

import type { ProjectTimeRangeControls_data$key } from "./__generated__/ProjectTimeRangeControls_data.graphql";

/**
 * How often each streamable project tab checks for new data. The span, trace
 * and session tables poll every few seconds. The evaluators tab polls less
 * often: its rows aggregate costs, failures, lag and scores over the time
 * range, so each refresh costs more, and results land in steady batches
 * rather than one span at a time.
 */
const REFRESH_INTERVAL_MS_BY_TAB: ReadonlyMap<string, number> = new Map([
  ["spans", 2000],
  ["traces", 2000],
  ["sessions", 2000],
  ["evaluators", EVALUATORS_LIVE_REFRESH_INTERVAL_MS],
]);

/**
 * The project page's time range control strip: pan/zoom buttons around a
 * live streaming toggle, rendered beside the time range selector. While
 * streaming is playing on a streamable tab, polls the project's
 * last-updated timestamp and bumps the shared fetch key when new data lands.
 * Streaming pauses while a trace or session drawer is open so the tables
 * behind it don't refetch.
 */
export function ProjectTimeRangeControls(props: {
  project: ProjectTimeRangeControls_data$key;
}) {
  const {
    isStreaming: isStreamingState,
    setIsStreaming,
    setFetchKey,
  } = useStreamState();
  const { tab } = useProjectRootPath();
  // Parent routes see child params, so this is set while the session drawer
  // is open; the trace and compare drawers are known from the selected traces
  const { sessionId } = useParams();
  const isDetailOpen = useSelectedTraceSlots().length > 0 || sessionId != null;
  const refreshIntervalMs = REFRESH_INTERVAL_MS_BY_TAB.get(tab) ?? null;
  const isStreamingTab = refreshIntervalMs != null;
  const isLiveStreaming = isStreamingTab && !isDetailOpen && isStreamingState;

  const [lastUpdatedAt, refetchLastUpdatedAt] = useRefetchableFragment(
    graphql`
      fragment ProjectTimeRangeControls_data on Project
      @refetchable(queryName: "ProjectTimeRangeControlsRefetchQuery") {
        streamingLastUpdatedAt
      }
    `,
    props.project
  );
  useInterval(
    () => {
      startTransition(() => {
        refetchLastUpdatedAt({}, { fetchPolicy: "store-and-network" });
      });
    },
    isLiveStreaming ? refreshIntervalMs : null
  );

  // We want to refetch higher up the render tree when lastUpdatedAt changes
  useOnLastUpdatedAtAdvance(
    lastUpdatedAt.streamingLastUpdatedAt,
    (currentLastUpdatedAt) => {
      setFetchKey(`fetch-traces-${currentLastUpdatedAt}`);
    }
  );

  return (
    <ConnectedTimeRangeControls
      isLive={isLiveStreaming}
      onIsLiveChange={isStreamingTab ? setIsStreaming : undefined}
      isLiveToggleDisabled={isDetailOpen}
    />
  );
}
