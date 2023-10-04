import React, {
  startTransition,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { graphql, useRefetchableFragment } from "react-relay";

import { Button, Icon, Icons } from "@arizeai/components";

import { useInterval } from "@phoenix/hooks/useInterval";

import { LiveStreamButton_data$key } from "./__generated__/LiveStreamButton_data.graphql";

/**
 * Check every few seconds for new data
 */
const REFRESH_INTERVAL_MS = 2000;

export function LiveStreamButton(props: {
  query: LiveStreamButton_data$key;
  onRefresh: () => void;
}) {
  const { onRefresh } = props;
  const [isLive, setIsLive] = useState<boolean>(true);

  const [traceCountData, refetchCounts] = useRefetchableFragment(
    graphql`
      fragment LiveStreamButton_data on Query
      @refetchable(queryName: "LiveStreamButtonRefetchQuery") {
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
  const refetchCountsIfLive = useCallback(() => {
    if (isLive) {
      startTransition(() => {
        refetchCounts({}, { fetchPolicy: "store-and-network" });
      });
    }
  }, [isLive, refetchCounts]);

  // We want to refetch higher up the render tree when the counts change
  const totalTraceCount = traceCountData.traceCount.pageInfo.totalCount;
  useEffect(() => {
    console.log(
      "useEffect" + totalTraceCount + "prev: " + loadedTraceCountRef.current
    );
    if (loadedTraceCountRef.current !== totalTraceCount) {
      console.log("useEffect: onRefresh");
      // Update the loaded trace count so the eff
      loadedTraceCountRef.current = totalTraceCount;
      onRefresh();
    }
  }, [onRefresh, totalTraceCount]);

  useInterval(refetchCountsIfLive, REFRESH_INTERVAL_MS);
  return (
    <Button
      variant="default"
      icon={
        <Icon svg={isLive ? <Icons.LoadingOutline /> : <Icons.PauseCircle />} />
      }
      onClick={() => {
        setIsLive(!isLive);
        onRefresh();
      }}
    >
      {isLive ? "Streaming" : "Paused"}
    </Button>
  );
}
