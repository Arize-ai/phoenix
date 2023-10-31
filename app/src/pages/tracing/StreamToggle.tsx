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

  const [traceCountData, refetchCounts] = useRefetchableFragment(
    graphql`
      fragment StreamToggle_data on Query
      @refetchable(queryName: "StreamToggleRefetchQuery") {
        traceCount: spans(rootSpansOnly: true) {
          pageInfo {
            totalCount
          }
        }
      }
    `,
    props.query
  );
  // Keep track of the loaded trace count so we can detect when it changes
  const loadedTraceCountRef = useRef<number>(
    traceCountData.traceCount.pageInfo.totalCount
  );

  // Refetch the count of traces if the streaming toggle is on
  const refetchCountsIfStreaming = useCallback(() => {
    if (isStreaming) {
      startTransition(() => {
        refetchCounts({}, { fetchPolicy: "store-and-network" });
      });
    }
  }, [isStreaming, refetchCounts]);

  // We want to refetch higher up the render tree when the counts change
  const totalTraceCount = traceCountData.traceCount.pageInfo.totalCount;
  useEffect(() => {
    if (loadedTraceCountRef.current !== totalTraceCount) {
      // Update the loaded trace count so the effect doesn't fire again
      loadedTraceCountRef.current = totalTraceCount;
      setFetchKey(`fetch-traces-${totalTraceCount}`);
    }
  }, [setFetchKey, totalTraceCount]);

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
