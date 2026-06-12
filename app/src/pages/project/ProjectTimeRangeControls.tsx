import { startTransition, useCallback, useEffect, useRef } from "react";
import { graphql, useRefetchableFragment } from "react-relay";
import { useLocation } from "react-router";

import { TimeRangeControls, useTimeRange } from "@phoenix/components/datetime";
import { useStreamState } from "@phoenix/contexts/StreamStateContext";
import { useInterval } from "@phoenix/hooks/useInterval";

import type { ProjectTimeRangeControls_data$key } from "./__generated__/ProjectTimeRangeControls_data.graphql";

/**
 * Check every few seconds for new data
 */
const REFRESH_INTERVAL_MS = 2000;

/**
 * Routes where streaming is enabled
 */
const STREAMING_ENABLED_ROUTE_TAILS = ["spans", "traces", "sessions"];

/**
 * The project page's time range control strip: pan/zoom buttons around a
 * play/pause toggle for live streaming, rendered beside the time range
 * selector. While streaming is playing, polls the project's last-updated
 * timestamp and bumps the shared fetch key when new data lands.
 */
export function ProjectTimeRangeControls(props: {
  project: ProjectTimeRangeControls_data$key;
}) {
  const {
    isStreaming: isStreamingState,
    setIsStreaming,
    setFetchKey,
  } = useStreamState();
  const { timeRange, setTimeRange } = useTimeRange();
  const location = useLocation();
  const currentPathTail = location.pathname.split("/").pop() || "";
  // Take into account both the current path and the streaming state for whether streaming is enabled
  // E.g. we don't want to stream when there is a sub-route active
  const isStreamingEnabled =
    STREAMING_ENABLED_ROUTE_TAILS.includes(currentPathTail) && isStreamingState;

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

  // Refetch lastUpdatedAt if streaming is playing to detect when the underlying data changes
  const refetchCountsIfStreaming = useCallback(() => {
    if (isStreamingEnabled) {
      startTransition(() => {
        refetchLastUpdatedAt({}, { fetchPolicy: "store-and-network" });
      });
    }
  }, [isStreamingEnabled, refetchLastUpdatedAt]);

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

  useInterval(refetchCountsIfStreaming, REFRESH_INTERVAL_MS);

  return (
    <TimeRangeControls
      value={timeRange}
      onChange={(nextTimeRange) => {
        startTransition(() => {
          setTimeRange(nextTimeRange);
        });
      }}
      isLive={isStreamingState}
      onIsLiveChange={setIsStreaming}
    />
  );
}
