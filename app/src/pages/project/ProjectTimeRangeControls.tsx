import { startTransition, useEffect, useRef } from "react";
import { graphql, useRefetchableFragment } from "react-relay";

import { ConnectedTimeRangeControls } from "@phoenix/components/datetime";
import { useStreamState } from "@phoenix/contexts/StreamStateContext";
import { useInterval } from "@phoenix/hooks/useInterval";
import { useProjectRootPath } from "@phoenix/hooks/useProjectRootPath";

import type { ProjectTimeRangeControls_data$key } from "./__generated__/ProjectTimeRangeControls_data.graphql";

/**
 * Check every few seconds for new data
 */
const REFRESH_INTERVAL_MS = 2000;

/**
 * Project tabs where live streaming is available.
 */
const STREAMING_ENABLED_TABS = ["spans", "traces", "sessions"];

/**
 * The project page's time range control strip: pan/zoom buttons around a
 * live streaming toggle, rendered beside the time range selector. While
 * streaming is playing on a streamable tab, polls the project's
 * last-updated timestamp and bumps the shared fetch key when new data lands.
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
  const isStreamingTab = STREAMING_ENABLED_TABS.includes(tab);
  const isLiveStreaming = isStreamingTab && isStreamingState;

  const [lastUpdatedAt, refetchLastUpdatedAt] = useRefetchableFragment(
    graphql`
      fragment ProjectTimeRangeControls_data on Project
      @refetchable(queryName: "ProjectTimeRangeControlsRefetchQuery") {
        streamingLastUpdatedAt
      }
    `,
    props.project
  );
  // Keep track of the loaded lastUpdatedAt, so we can detect when it changes
  const loadedLastUpdatedAtRef = useRef<string | null>(
    lastUpdatedAt.streamingLastUpdatedAt
  );

  useInterval(
    () => {
      startTransition(() => {
        refetchLastUpdatedAt({}, { fetchPolicy: "store-and-network" });
      });
    },
    isLiveStreaming ? REFRESH_INTERVAL_MS : null
  );

  // We want to refetch higher up the render tree when lastUpdatedAt changes
  const currentLastUpdatedAt = lastUpdatedAt.streamingLastUpdatedAt;
  useEffect(() => {
    if (
      currentLastUpdatedAt != null &&
      (loadedLastUpdatedAtRef.current == null ||
        loadedLastUpdatedAtRef.current < currentLastUpdatedAt)
    ) {
      // Update the loaded lastUpdatedAt so the effect doesn't fire again
      loadedLastUpdatedAtRef.current = currentLastUpdatedAt;
      setFetchKey(`fetch-traces-${currentLastUpdatedAt}`);
    }
  }, [setFetchKey, currentLastUpdatedAt]);

  return (
    <ConnectedTimeRangeControls
      isLive={isLiveStreaming}
      onIsLiveChange={isStreamingTab ? setIsStreaming : undefined}
    />
  );
}
