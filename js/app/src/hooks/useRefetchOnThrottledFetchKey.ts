import { useEffect, useEffectEvent, useRef } from "react";

import { useStreamState } from "@phoenix/contexts/StreamStateContext";

/**
 * Runs `refetch` whenever `throttledFetchKey` changes after mount; the
 * parent query has just loaded the data at mount.
 *
 * @param refetch - the refetch to run; it always sees the latest render
 */
export function useRefetchOnThrottledFetchKey(refetch: () => void) {
  const { throttledFetchKey } = useStreamState();
  const lastFetchKeyRef = useRef(throttledFetchKey);
  const onThrottledFetchKeyChange = useEffectEvent(refetch);
  useEffect(() => {
    if (lastFetchKeyRef.current === throttledFetchKey) {
      return;
    }
    lastFetchKeyRef.current = throttledFetchKey;
    onThrottledFetchKeyChange();
  }, [throttledFetchKey]);
}
