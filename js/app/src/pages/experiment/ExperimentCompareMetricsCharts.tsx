import type { ReactNode } from "react";
import { Suspense, useCallback } from "react";

import { Loading } from "@phoenix/components";
import {
  ChartPanelStrip,
  getMetricChartsViewSetting,
  MetricChartsPanelGroup,
} from "@phoenix/components/chart";
import type { TableViewSetting } from "@phoenix/components/table";
import type {
  BuiltInExperimentMetricChartKey,
  ExperimentMetricChartKey,
} from "@phoenix/pages/dataset/constants";
import { getExperimentAnnotationMetricChartKey } from "@phoenix/pages/dataset/constants";
import {
  DeferredExperimentMetricPanel,
  getExperimentMetricCharts,
} from "@phoenix/pages/dataset/metrics/chartCatalog";
import type { ComparedExperimentSelection } from "@phoenix/pages/dataset/metrics/types";
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
  experimentSelection: ComparedExperimentSelection;
};

/**
 * The names of the evaluators present on the selected experiments, sorted
 * alphabetically. Read from the metrics query the charts share, so it adds no
 * request of its own.
 */
function useCompareAnnotationNames({
  datasetId,
  experimentSelection,
}: CompareChartsProps): string[] {
  const { experiments } = useExperimentMetricsData({
    datasetId,
    experimentSelection,
  });
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
 * Whether the dataset's compare grid has charts selected and shows them, and a
 * setter for the visibility. The default selection always includes built-in
 * charts.
 */
function useCompareChartsVisibility(datasetId: string): {
  hasCharts: boolean;
  isVisible: boolean;
  setIsVisible: (isVisible: boolean) => void;
} {
  const persistedKeys = usePersistedCompareChartKeys(datasetId);
  const isVisible = useExperimentCompareChartsStore(
    (state) => state.areMetricChartsVisibleByDatasetId[datasetId] ?? true
  );
  const setAreMetricChartsVisible = useExperimentCompareChartsStore(
    (state) => state.setAreMetricChartsVisible
  );
  const setIsVisible = useCallback(
    (isVisible: boolean) => setAreMetricChartsVisible({ datasetId, isVisible }),
    [datasetId, setAreMetricChartsVisible]
  );
  return {
    hasCharts: persistedKeys == null || persistedKeys.length > 0,
    isVisible,
    setIsVisible,
  };
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
  experimentSelection,
}: CompareChartsProps) {
  const persistedKeys = usePersistedCompareChartKeys(datasetId);
  return persistedKeys != null ? (
    <CompareChartsStrip
      datasetId={datasetId}
      experimentSelection={experimentSelection}
      keys={persistedKeys}
    />
  ) : (
    <DefaultCompareChartsStrip
      datasetId={datasetId}
      experimentSelection={experimentSelection}
    />
  );
}

/**
 * The default charts, which need the selected experiments' evaluator names.
 * Only this path reads the metrics query up front, so a persisted selection
 * lets each chart load on its own.
 */
function DefaultCompareChartsStrip({
  datasetId,
  experimentSelection,
}: CompareChartsProps) {
  const annotationNames = useCompareAnnotationNames({
    datasetId,
    experimentSelection,
  });
  return (
    <CompareChartsStrip
      datasetId={datasetId}
      experimentSelection={experimentSelection}
      keys={getCompareGridChartKeys({ persistedKeys: null, annotationNames })}
    />
  );
}

function CompareChartsStrip({
  datasetId,
  experimentSelection,
  keys,
}: CompareChartsProps & { keys: ExperimentMetricChartKey[] }) {
  const charts = getExperimentMetricCharts(keys);
  return (
    <ChartPanelStrip chartCount={charts.length}>
      {charts.map((chart) => (
        <DeferredExperimentMetricPanel
          key={chart.key}
          chart={chart}
          datasetId={datasetId}
          experimentSelection={experimentSelection}
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
  experimentSelection,
  children,
}: CompareChartsProps & { children: ReactNode }) {
  const { hasCharts, isVisible } = useCompareChartsVisibility(datasetId);
  return (
    <MetricChartsPanelGroup
      layoutId="experiment-compare-grid-metrics-layout"
      charts={
        hasCharts && isVisible ? (
          <Suspense fallback={<Loading />}>
            <ExperimentCompareGridCharts
              datasetId={datasetId}
              experimentSelection={experimentSelection}
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
 * The compare grid's view setting that shows or hides the charts. The
 * visibility is persisted per dataset.
 */
export function useExperimentCompareChartsViewSetting(
  datasetId: string
): TableViewSetting {
  return getMetricChartsViewSetting(useCompareChartsVisibility(datasetId));
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
  experimentSelection,
}: CompareChartsProps) {
  const annotationNames = useCompareAnnotationNames({
    datasetId,
    experimentSelection,
  });
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
      experimentSelection={experimentSelection}
    />
  );
}
