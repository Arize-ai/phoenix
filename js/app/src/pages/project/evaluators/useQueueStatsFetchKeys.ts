import { useState } from "react";

import { useStreamState } from "@phoenix/contexts/StreamStateContext";

/**
 * The evaluators tab's fetch keys: the stream state's, each also moved by
 * `refresh` when the page changes the queue (clears it, toggles an evaluator).
 *
 * @returns `fetchKey` for the queue strip, `throttledFetchKey` for the charts,
 * and `refresh`
 */
export function useQueueStatsFetchKeys() {
  const { fetchKey, throttledFetchKey } = useStreamState();
  const [refreshCount, setRefreshCount] = useState(0);
  const refresh = () => setRefreshCount((count) => count + 1);
  return {
    fetchKey: `${fetchKey}:${refreshCount}`,
    throttledFetchKey: `${throttledFetchKey}:${refreshCount}`,
    refresh,
  };
}
