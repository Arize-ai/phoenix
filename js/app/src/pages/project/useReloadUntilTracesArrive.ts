import { useEffect, useEffectEvent, useRef } from "react";

import { useStreamState } from "@phoenix/contexts/StreamStateContext";

/**
 * While a project has no traces, reload the query that decides between
 * onboarding and the table each time live streaming detects new data. Once
 * traces exist this does nothing and the table's own refetch takes over.
 *
 * Mounting is deliberately not a trigger: the page already loads the active
 * tab from the network on entry while the project has no traces.
 */
export function useReloadUntilTracesArrive({
  hasTraces,
  reload,
}: {
  hasTraces: boolean;
  reload: () => void;
}) {
  const { fetchKey } = useStreamState();
  // Not dependencies: the reload's identity changes with the tab and seed, and
  // either change has just loaded its own query.
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
