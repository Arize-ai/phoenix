import React, { startTransition, useCallback, useEffect, useRef } from "react";
import { graphql, useRefetchableFragment } from "react-relay";

import { Switch } from "@arizeai/components";

import { useStreamState } from "@phoenix/contexts/StreamStateContext";
import { useInterval } from "@phoenix/hooks/useInterval";

import { StreamToggle_data$key } from "./__generated__/StreamToggle_data.graphql";

/**
 * Check every few seconds for new data
 */
const REFRESH_INTERVAL_MS = 2000;

export function StreamToggle(props: { query: StreamToggle_data$key }) {
  const { isStreaming, setIsStreaming, setFetchKey } = useStreamState();

  const [lastUpdatedAt, refetchLastUpdatedAt] = useRefetchableFragment(
    graphql`
      fragment StreamToggle_data on Query
      @refetchable(queryName: "StreamToggleRefetchQuery") {
        streamingLastUpdatedAt
      }
    `,
    props.query
  );
  // Keep track of the loaded trace count so we can detect when it changes
  const loadedLastUpdatedAtRef = useRef<string | null>(
    lastUpdatedAt.streamingLastUpdatedAt
  );

  // Refetch the count of traces if the streaming toggle is on
  const refetchCountsIfStreaming = useCallback(() => {
    if (isStreaming) {
      startTransition(() => {
        refetchLastUpdatedAt({}, { fetchPolicy: "store-and-network" });
      });
    }
  }, [isStreaming, refetchLastUpdatedAt]);

  // We want to refetch higher up the render tree when the counts change
  const currentLastUpdatedAt = lastUpdatedAt.streamingLastUpdatedAt;
  useEffect(() => {
    if (
      currentLastUpdatedAt != null &&
      (loadedLastUpdatedAtRef.current == null ||
        loadedLastUpdatedAtRef.current < currentLastUpdatedAt)
    ) {
      // Update the loaded trace count so the effect doesn't fire again
      loadedLastUpdatedAtRef.current = currentLastUpdatedAt;
      setFetchKey(`fetch-traces-${currentLastUpdatedAt}`);
    }
  }, [setFetchKey, currentLastUpdatedAt]);

  useInterval(refetchCountsIfStreaming, REFRESH_INTERVAL_MS);
  return (
    <Switch
      labelPlacement="start"
      defaultSelected
      onChange={() => {
        setIsStreaming(!isStreaming);
      }}
    >
      Stream
    </Switch>
  );
}
