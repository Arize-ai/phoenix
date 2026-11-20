import { useEffect, useEffectEvent } from "react";

import { useStreamState } from "@phoenix/contexts/StreamStateContext";

/**
 * Runs `refetch` on mount and whenever `throttledFetchKey` changes.
 *
 * @param refetch - the refetch to run; it always sees the latest render
 */
export function useRefetchOnThrottledFetchKey(refetch: () => void) {
  const { throttledFetchKey } = useStreamState();
  const onThrottledFetchKeyChange = useEffectEvent(refetch);
  useEffect(() => {
    onThrottledFetchKeyChange();
  }, [throttledFetchKey]);
}
