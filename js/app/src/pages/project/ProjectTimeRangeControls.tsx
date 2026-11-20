import {
  startTransition,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  useTransition,
} from "react";
import { graphql, useRefetchableFragment } from "react-relay";
import { useParams } from "react-router";

import {
  ConnectedTimeRangeControls,
  useTimeRange,
} from "@phoenix/components/datetime";
import { useStreamState } from "@phoenix/contexts/StreamStateContext";
import { useInterval } from "@phoenix/hooks/useInterval";
import { useOnTimestampAdvance } from "@phoenix/hooks/useOnTimestampAdvance";
import { useProjectRootPath } from "@phoenix/hooks/useProjectRootPath";
import { EVALUATORS_LIVE_REFRESH_INTERVAL_MS } from "@phoenix/pages/project/constants";
import { useSelectedTraceSlots } from "@phoenix/pages/project/useSelectedTraceSlots";

import type { ProjectTimeRangeControls_data$key } from "./__generated__/ProjectTimeRangeControls_data.graphql";

const CLEARING_POLL_INTERVAL_MS = 3_000;

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
 * behind it don't refetch, and while the page is hidden: new data seen then
 * refreshes the page once it is visible again.
 */
export function ProjectTimeRangeControls(props: {
  project: ProjectTimeRangeControls_data$key;
}) {
  const {
    isStreaming: isStreamingState,
    setIsStreaming,
    setFetchKey,
  } = useStreamState();
  const { refreshLiveTimeRange } = useTimeRange();
  const { tab } = useProjectRootPath();
  // Parent routes see child params, so this is set while the session drawer
  // is open; the trace and compare drawers are known from the selected traces
  const { sessionId } = useParams();
  const isDetailOpen = useSelectedTraceSlots().length > 0 || sessionId != null;
  const refreshIntervalMs = REFRESH_INTERVAL_MS_BY_TAB.get(tab) ?? null;
  const isStreamingTab = refreshIntervalMs != null;
  const isLiveStreaming = isStreamingTab && !isDetailOpen && isStreamingState;
  const [isRefreshing, startRefreshTransition] = useTransition();

  const [projectStatus, refetchProjectStatus] = useRefetchableFragment(
    graphql`
      fragment ProjectTimeRangeControls_data on Project
      @refetchable(queryName: "ProjectTimeRangeControlsRefetchQuery") {
        streamingLastUpdatedAt
        isClearingTraces
      }
    `,
    props.project
  );
  const isClearingTraces = projectStatus.isClearingTraces ?? false;
  const isPollInFlightRef = useRef(false);
  useEffect(() => {
    return () => {
      isPollInFlightRef.current = false;
    };
  }, []);

  const liveIntervalMs = isLiveStreaming ? refreshIntervalMs : null;
  const clearingIntervalMs = isClearingTraces
    ? CLEARING_POLL_INTERVAL_MS
    : null;
  const pollIntervalMs =
    liveIntervalMs != null && clearingIntervalMs != null
      ? Math.min(liveIntervalMs, clearingIntervalMs)
      : (liveIntervalMs ?? clearingIntervalMs);

  useInterval(
    () => {
      if (isPollInFlightRef.current) {
        return;
      }
      startTransition(() => {
        let isSettled = false;
        const disposable = refetchProjectStatus(
          {},
          {
            fetchPolicy: "store-and-network",
            onComplete: (error) => {
              isSettled = true;
              isPollInFlightRef.current = false;
              if (error != null) {
                disposable?.dispose();
              }
            },
          }
        );
        if (disposable != null && !isSettled) {
          isPollInFlightRef.current = true;
        }
      });
    },
    !isRefreshing ? pollIntervalMs : null
  );

  const streamingLastUpdatedAt = projectStatus.streamingLastUpdatedAt ?? null;
  const [liveLastUpdatedAt, setLiveLastUpdatedAt] = useState(
    streamingLastUpdatedAt
  );
  if (isLiveStreaming && liveLastUpdatedAt !== streamingLastUpdatedAt) {
    setLiveLastUpdatedAt(streamingLastUpdatedAt);
  }

  // New data landed: slide a live time range forward and refetch the tables
  // below, keeping the current rows up while they load
  function refreshForNewData(currentLastUpdatedAt: string) {
    startRefreshTransition(() => {
      refreshLiveTimeRange();
      setFetchKey(`fetch-traces-${currentLastUpdatedAt}`);
    });
  }
  const heldLastUpdatedAtRef = useRef<string | null>(null);
  useOnTimestampAdvance(liveLastUpdatedAt, (currentLastUpdatedAt) => {
    if (document.visibilityState === "hidden") {
      heldLastUpdatedAtRef.current = currentLastUpdatedAt;
    } else {
      refreshForNewData(currentLastUpdatedAt);
    }
  });
  const refreshForHeldData = useEffectEvent(() => {
    const heldLastUpdatedAt = heldLastUpdatedAtRef.current;
    if (heldLastUpdatedAt != null && document.visibilityState !== "hidden") {
      heldLastUpdatedAtRef.current = null;
      refreshForNewData(heldLastUpdatedAt);
    }
  });
  useEffect(() => {
    document.addEventListener("visibilitychange", refreshForHeldData);
    return () =>
      document.removeEventListener("visibilitychange", refreshForHeldData);
  }, []);

  const wasClearingRef = useRef(isClearingTraces);
  const clearCompletionCountRef = useRef(0);
  const handleClearingCompleted = useEffectEvent(() => {
    clearCompletionCountRef.current += 1;
    const completionCount = clearCompletionCountRef.current;
    startRefreshTransition(() => {
      if (isLiveStreaming) {
        refreshLiveTimeRange();
      }
      setFetchKey(`clear-completed-${completionCount}`);
    });
  });
  useEffect(() => {
    const didFinishClearing = wasClearingRef.current && !isClearingTraces;
    wasClearingRef.current = isClearingTraces;
    if (didFinishClearing) {
      handleClearingCompleted();
    }
  }, [isClearingTraces]);

  return (
    <ConnectedTimeRangeControls
      isLive={isLiveStreaming}
      onIsLiveChange={isStreamingTab ? setIsStreaming : undefined}
      isLiveToggleDisabled={isDetailOpen}
    />
  );
}
