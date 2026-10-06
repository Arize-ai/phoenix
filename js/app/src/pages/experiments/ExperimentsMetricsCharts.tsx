import type { ReactNode } from "react";

import {
  ChartPanelStrip,
  MetricChartsPanelGroup,
} from "@phoenix/components/chart";
import type { TableViewSetting } from "@phoenix/components/table";
import { useDatasetContext } from "@phoenix/contexts/DatasetContext";
import {
  DeferredExperimentMetricPanel,
  getExperimentMetricCharts,
} from "@phoenix/pages/dataset/metrics/chartCatalog";

/**
 * A strip of user-selected metric charts shown above the experiments table.
 * Any chart in the experiment metric chart catalog can be added. The
 * selection is persisted per dataset.
 */
export function ExperimentsMetricsCharts() {
  const datasetId = useDatasetContext((state) => state.datasetId);
  const selectedChartKeys = useDatasetContext(
    (state) => state.experimentsMetricChartKeys
  );
  const charts = getExperimentMetricCharts(selectedChartKeys);
  return (
    <ChartPanelStrip chartCount={charts.length}>
      {charts.map((chart) => (
        <DeferredExperimentMetricPanel
          key={chart.key}
          chart={chart}
          datasetId={datasetId}
          fillHeight
        />
      ))}
    </ChartPanelStrip>
  );
}

/**
 * Lays out the experiment metric charts strip above the experiments table in
 * a vertically resizable panel group. When no charts are selected or the
 * charts are hidden, the table content fills the space.
 */
export function ExperimentsMetricsChartsPanelGroup({
  children,
}: {
  children: ReactNode;
}) {
  // The store guarantees keys are valid catalog keys, so any selection means
  // there are charts to show
  const hasCharts = useDatasetContext(
    (state) => state.experimentsMetricChartKeys.length > 0
  );
  const isVisible = useDatasetContext(
    (state) => state.areExperimentsMetricChartsVisible
  );
  return (
    <MetricChartsPanelGroup
      layoutId="experiments-table-metrics-layout"
      charts={hasCharts && isVisible ? <ExperimentsMetricsCharts /> : null}
    >
      {children}
    </MetricChartsPanelGroup>
  );
}

/**
 * The experiments table's view setting that shows or hides the charts. The
 * visibility is persisted per dataset.
 */
export function useExperimentsMetricChartsViewSetting(): TableViewSetting {
  const hasCharts = useDatasetContext(
    (state) => state.experimentsMetricChartKeys.length > 0
  );
  const isVisible = useDatasetContext(
    (state) => state.areExperimentsMetricChartsVisible
  );
  const setIsVisible = useDatasetContext(
    (state) => state.setAreExperimentsMetricChartsVisible
  );
  return {
    id: "show-charts",
    label: "Show charts",
    isEnabled: isVisible,
    onChange: setIsVisible,
    isDisabled: !hasCharts,
  };
}
