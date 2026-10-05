import type { ReactNode } from "react";
import { Suspense } from "react";

import { Loading } from "@phoenix/components";
import {
  ChartPanelStrip,
  MetricChartsPanelGroup,
} from "@phoenix/components/chart";
import type {
  BuiltInExperimentMetricChartKey,
  ExperimentMetricChartKey,
} from "@phoenix/pages/dataset/constants";
import { getExperimentAnnotationMetricChartKey } from "@phoenix/pages/dataset/constants";
import {
  DeferredExperimentMetricPanel,
  getExperimentMetricCharts,
} from "@phoenix/pages/dataset/metrics/chartCatalog";
import type { ExperimentMetricsSelection } from "@phoenix/pages/dataset/metrics/types";
import { useExperimentMetricsData } from "@phoenix/pages/dataset/metrics/useExperimentMetricsData";
import {
  ExperimentChartSelectorMenu,
  ExperimentMetricsChartSelectorTrigger,
} from "@phoenix/pages/experiments/ExperimentsMetricsChartSelector";
import { useExperimentCompareChartsStore } from "@phoenix/store/experimentCompareChartsStore";

/**
 * The built-in charts shown above the compare grid, after one chart per
 * evaluator, until the user picks charts for the dataset.
 */
const DEFAULT_COMPARE_GRID_BUILT_IN_CHART_KEYS: readonly BuiltInExperimentMetricChartKey[] =
  ["latency"];

type CompareChartsProps = {
  datasetId: string;
  selection: ExperimentMetricsSelection;
};

/**
 * The names of the evaluators present on the selected experiments, sorted
 * alphabetically. Read from the metrics query the charts share, so it adds no
 * request of its own.
 */
function useCompareAnnotationNames({
  datasetId,
  selection,
}: CompareChartsProps): string[] {
  const { experiments } = useExperimentMetricsData({ datasetId, selection });
  return Array.from(
    new Set(
      experiments.flatMap(({ annotationSummaries }) =>
        annotationSummaries.map(({ annotationName }) => annotationName)
      )
    )
  ).sort((left, right) => left.localeCompare(right));
}

/**
 * The dataset's persisted compare grid chart selection, or null when the user
 * has not picked charts for the dataset yet.
 */
function usePersistedCompareChartKeys(
  datasetId: string
): ExperimentMetricChartKey[] | null {
  return useExperimentCompareChartsStore(
    (state) => state.metricChartKeysByDatasetId[datasetId] ?? null
  );
}

/**
 * The charts shown above the compare grid: the dataset's persisted selection,
 * or by default one chart per evaluator on the selected experiments followed
 * by the default built-in charts.
 */
function getCompareGridChartKeys({
  persistedKeys,
  annotationNames,
}: {
  persistedKeys: ExperimentMetricChartKey[] | null;
  annotationNames: readonly string[];
}): ExperimentMetricChartKey[] {
  return (
    persistedKeys ?? [
      ...annotationNames.map(getExperimentAnnotationMetricChartKey),
      ...DEFAULT_COMPARE_GRID_BUILT_IN_CHART_KEYS,
    ]
  );
}

function ExperimentCompareGridCharts({
  datasetId,
  selection,
}: CompareChartsProps) {
  const charts = getExperimentMetricCharts(
    getCompareGridChartKeys({
      persistedKeys: usePersistedCompareChartKeys(datasetId),
      annotationNames: useCompareAnnotationNames({ datasetId, selection }),
    })
  );
  return (
    <ChartPanelStrip chartCount={charts.length}>
      {charts.map((chart) => (
        <DeferredExperimentMetricPanel
          key={chart.key}
          chart={chart}
          datasetId={datasetId}
          selection={selection}
          fillHeight
        />
      ))}
    </ChartPanelStrip>
  );
}

/**
 * Lays out the compared experiments' metric charts strip above the compare
 * grid in a vertically resizable panel group, mirroring the charts above the
 * experiments and tracing tables.
 */
export function ExperimentCompareChartsPanelGroup({
  datasetId,
  selection,
  children,
}: CompareChartsProps & { children: ReactNode }) {
  const persistedKeys = usePersistedCompareChartKeys(datasetId);
  // The default selection always includes built-in charts
  const hasCharts = persistedKeys == null || persistedKeys.length > 0;
  return (
    <MetricChartsPanelGroup
      layoutId="experiment-compare-grid-metrics-layout"
      charts={
        hasCharts ? (
          <Suspense fallback={<Loading />}>
            <ExperimentCompareGridCharts
              datasetId={datasetId}
              selection={selection}
            />
          </Suspense>
        ) : null
      }
    >
      {children}
    </MetricChartsPanelGroup>
  );
}

/**
 * The chart selector shown in the compare grid's filter bar. The selection is
 * persisted per dataset.
 */
export function ExperimentCompareChartSelector(props: CompareChartsProps) {
  return (
    <ExperimentMetricsChartSelectorTrigger>
      <ExperimentCompareChartSelectorMenu {...props} />
    </ExperimentMetricsChartSelectorTrigger>
  );
}

function ExperimentCompareChartSelectorMenu({
  datasetId,
  selection,
}: CompareChartsProps) {
  const annotationNames = useCompareAnnotationNames({ datasetId, selection });
  const persistedKeys = usePersistedCompareChartKeys(datasetId);
  const setMetricChartKeys = useExperimentCompareChartsStore(
    (state) => state.setMetricChartKeys
  );
  return (
    <ExperimentChartSelectorMenu
      annotationNames={annotationNames}
      selectedChartKeys={getCompareGridChartKeys({
        persistedKeys,
        annotationNames,
      })}
      onSelectionChange={(keys) => setMetricChartKeys({ datasetId, keys })}
      selection={selection}
    />
  );
}
