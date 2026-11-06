import type { TableViewSetting } from "@phoenix/components/table";

/**
 * The table view setting that shows or hides a metric charts strip
 */
export function getMetricChartsViewSetting({
  isVisible,
  setIsVisible,
}: {
  isVisible: boolean;
  setIsVisible: (isVisible: boolean) => void;
}): TableViewSetting {
  return {
    id: "show-charts",
    label: "Show charts",
    isEnabled: isVisible,
    onChange: setIsVisible,
  };
}
