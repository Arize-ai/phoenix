import { useEffect, useEffectEvent } from "react";

import { useStreamState } from "@phoenix/contexts/StreamStateContext";

/**
 * Run `refetch` whenever live streaming detects new data, and once on mount.
 * The callback always sees the latest render, so callers pass a fresh closure
 * without it becoming a dependency.
 */
export function useRefetchOnStreamAdvance(refetch: () => void) {
  const { fetchKey } = useStreamState();
  const onStreamAdvance = useEffectEvent(refetch);
  useEffect(() => {
    onStreamAdvance();
  }, [fetchKey]);
}
