import { useState } from "react";

import { useStreamState } from "@phoenix/contexts/StreamStateContext";

/**
 * The refresh key for the project evaluators tab's queue aside. Pass it to
 * the aside so its stats refetch at once rather than on their next poll.
 *
 * `refreshKey` changes when:
 * - `refresh` is called, because something on this page changed the queue,
 *   such as clearing it or toggling an evaluator.
 * - the project page's live stream advances, because new spans or
 *   evaluation results moved the queue. The evaluators table refetches on
 *   the same advance, so the two stay in step.
 *
 * Call it under the project page's `StreamStateProvider`.
 *
 * @returns `refreshKey`, and `refresh`, which marks the queue as changed.
 */
export function useQueueStatsRefreshKey() {
  const { fetchKey: streamFetchKey } = useStreamState();
  const [refreshCount, setRefreshCount] = useState(0);
  const refresh = () => setRefreshCount((count) => count + 1);
  return { refreshKey: `${streamFetchKey}:${refreshCount}`, refresh };
}
