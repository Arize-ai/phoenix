import {
  ChartPanelStrip,
  getMetricChartsViewSetting,
} from "@phoenix/components/chart";
import type { TableViewSetting } from "@phoenix/components/table";
import { useDatasetContext } from "@phoenix/contexts/DatasetContext";
import {
  DeferredExperimentMetricPanel,
  getExperimentMetricCharts,
} from "@phoenix/pages/dataset/metrics/chartCatalog";
import { RECENT_EXPERIMENT_SELECTION } from "@phoenix/pages/dataset/metrics/types";

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
          experimentSelection={RECENT_EXPERIMENT_SELECTION}
          fillHeight
        />
      ))}
    </ChartPanelStrip>
  );
}

/**
 * Whether the experiments table has charts selected and shows them, and a
 * setter for the visibility. The store guarantees keys are valid catalog keys,
 * so any selection means there are charts to show.
 */
function useExperimentsMetricChartsVisibility() {
  const hasCharts = useDatasetContext(
    (state) => state.experimentsMetricChartKeys.length > 0
  );
  const isVisible = useDatasetContext(
    (state) => state.areExperimentsMetricChartsVisible
  );
  const setIsVisible = useDatasetContext(
    (state) => state.setAreExperimentsMetricChartsVisible
  );
  return { hasCharts, isVisible, setIsVisible };
}

/**
 * Whether the charts strip is shown above the experiments table: charts are
 * selected and the user has not hidden them
 */
export function useAreExperimentsMetricChartsShown(): boolean {
  const { hasCharts, isVisible } = useExperimentsMetricChartsVisibility();
  return hasCharts && isVisible;
}

/**
 * The experiments table's view setting that shows or hides the charts. The
 * visibility is persisted per dataset.
 */
export function useExperimentsMetricChartsViewSetting(): TableViewSetting {
  return getMetricChartsViewSetting(useExperimentsMetricChartsVisibility());
}
