import { getTraceTreePanelSizing } from "@phoenix/components/trace/traceTreeSizing";

import type { SessionView } from "./SessionViewTabs";

/**
 * Derive one stable navigation-column contract for the whole session drawer.
 *
 * Traces may render timing content, but turns and traces share the same
 * resizable column and persisted preference. The selected view is deliberately
 * not part of the calculation: switching views must not dispatch a constraint
 * change that can re-derive the drawer from stale effective geometry.
 */
export function getSessionDetailsPanelSizing({
  showMetricsInTraceTree,
}: {
  sessionView: SessionView;
  showMetricsInTraceTree: boolean;
}): ReturnType<typeof getTraceTreePanelSizing> {
  return getTraceTreePanelSizing({ hasTiming: showMetricsInTraceTree });
}
