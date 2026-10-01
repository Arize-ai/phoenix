import { useEffect, useEffectEvent, useRef } from "react";

import { useStreamState } from "@phoenix/contexts/StreamStateContext";

/**
 * While a project has no traces, reload the query that decides between
 * onboarding and the table each time live streaming detects new data. Once
 * traces exist this does nothing and the table's own refetch takes over.
 *
 * Mounting is deliberately not a trigger. The page already loads from the
 * network on tab entry while the project has no traces, and a load from here
 * in that same commit would be released by the page's query loader before it
 * renders.
 */
export function useReloadUntilTracesArrive({
  hasTraces,
  reload,
}: {
  hasTraces: boolean;
  reload: () => void;
}) {
  const { fetchKey } = useStreamState();
  // Not dependencies: the reload's identity changes with the seed, and a new
  // seed has just loaded its own query.
  const onNewData = useEffectEvent(() => {
    if (!hasTraces) {
      reload();
    }
  });
  const handledFetchKeyRef = useRef(fetchKey);
  useEffect(() => {
    if (handledFetchKeyRef.current === fetchKey) {
      return;
    }
    handledFetchKeyRef.current = fetchKey;
    onNewData();
  }, [fetchKey]);
}
