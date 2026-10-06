import type { TableViewSetting } from "@phoenix/components/table";

/**
 * The table view setting that shows or hides a metric charts strip. It is
 * disabled when no charts are selected, since there is nothing to show.
 */
export function getMetricChartsViewSetting({
  hasCharts,
  isVisible,
  setIsVisible,
}: {
  hasCharts: boolean;
  isVisible: boolean;
  setIsVisible: (isVisible: boolean) => void;
}): TableViewSetting {
  return {
    id: "show-charts",
    label: "Show charts",
    isEnabled: isVisible,
    onChange: setIsVisible,
    isDisabled: !hasCharts,
  };
}
