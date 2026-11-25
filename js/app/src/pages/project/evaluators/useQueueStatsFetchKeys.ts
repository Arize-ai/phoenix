import { useState } from "react";

import { useStreamState } from "@phoenix/contexts/StreamStateContext";
import { useQueueStatsPoll } from "@phoenix/pages/project/evaluators/evaluationQueueStatParts";

/**
 * The evaluators tab's fetch keys, from one queue poll: `fetchKey` for the
 * queue strip also moves with each stream advance; `throttledFetchKey` for
 * the charts moves at most once a minute. `refresh`, for a change this page
 * makes to the queue (clearing it, toggling an evaluator), moves both.
 *
 * @returns `fetchKey`, `throttledFetchKey` and `refresh`
 */
export function useQueueStatsFetchKeys() {
  const { fetchKey: streamFetchKey } = useStreamState();
  const [refreshCount, setRefreshCount] = useState(0);
  const { fetchKey: pollFetchKey, throttledFetchKey } = useQueueStatsPoll({
    refreshKey: refreshCount,
  });
  const refresh = () => setRefreshCount((count) => count + 1);
  return {
    fetchKey: `${streamFetchKey}:${pollFetchKey}`,
    throttledFetchKey,
    refresh,
  };
}
