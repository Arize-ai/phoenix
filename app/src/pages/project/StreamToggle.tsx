import { startTransition, useCallback, useEffect, useRef } from "react";
import { graphql, useRefetchableFragment } from "react-relay";
import { useLocation } from "react-router";

import { Switch } from "@arizeai/components";

import { useStreamState } from "@phoenix/contexts/StreamStateContext";
import { useInterval } from "@phoenix/hooks/useInterval";

import { StreamToggle_data$key } from "./__generated__/StreamToggle_data.graphql";

/**
 * Check every few seconds for new data
 */
const REFRESH_INTERVAL_MS = 2000;

/**
 * Routes where streaming is enabled
 */
const STREAMING_ENABLED_ROUTE_TAILS = ["spans", "traces", "sessions"];

export function StreamToggle(props: { project: StreamToggle_data$key }) {
  const {
    isStreaming: isStreamingState,
    setIsStreaming,
    setFetchKey,
  } = useStreamState();
  const location = useLocation();
  const currentPathTail = location.pathname.split("/").pop() || "";
  // Take into account both the current path and the streaming state for whether streaming is enabled
  // E.g. we don't want to stream when there is a sub-route active
  const isStreamingEnabled =
    STREAMING_ENABLED_ROUTE_TAILS.includes(currentPathTail) && isStreamingState;

  const [lastUpdatedAt, refetchLastUpdatedAt] = useRefetchableFragment(
    graphql`
      fragment StreamToggle_data on Project
      @refetchable(queryName: "StreamToggleRefetchQuery") {
        streamingLastUpdatedAt
      }
    `,
    props.project
  );
  // Keep track of the loaded lastUpdatedAt, so we can detect when it changes
  const loadedLastUpdatedAtRef = useRef<string | null>(
    lastUpdatedAt.streamingLastUpdatedAt
  );

  // Refetch lastUpdatedAt if the streaming toggle is on to detect when the underlying data changes
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
    <Switch
      labelPlacement="start"
      isSelected={isStreamingState}
      onChange={() => {
        setIsStreaming(!isStreamingState);
      }}
    >
      Stream
    </Switch>
  );
}
