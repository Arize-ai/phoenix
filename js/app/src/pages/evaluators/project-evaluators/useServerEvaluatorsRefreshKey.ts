import { useState } from "react";

/**
 * The Evaluators page's Project evaluators tab refetches as one: the queue
 * strip, the charts, the project picker, and the table all take
 * `refreshKey` as their Relay `fetchKey`. Each also has its own poll or
 * reload, so a refresh only matters when the page should not wait for it.
 *
 * Call `refresh` when:
 * - something on this page changed the queue, such as clearing it, so the
 *   change shows at once.
 * - the live controls report new spans or evaluation results.
 *
 * @returns `refreshKey`, which changes on every refresh, and `refresh`.
 */
export function useServerEvaluatorsRefreshKey() {
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = () => setRefreshKey((key) => key + 1);
  return { refreshKey, refresh };
}
