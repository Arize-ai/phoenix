import type { ReactNode } from "react";
import { Suspense } from "react";

import {
  Button,
  Flex,
  Icon,
  Icons,
  Loading,
  MenuContainer,
  MenuTrigger,
} from "@phoenix/components";
import { MetricsChartSelector } from "@phoenix/components/chart";
import { useDatasetContext } from "@phoenix/contexts/DatasetContext";
import {
  type ExperimentMetricChartKey,
  getExperimentAnnotationMetricChartKey,
  getExperimentAnnotationName,
} from "@phoenix/pages/dataset/constants";
import {
  EXPERIMENT_METRIC_CHARTS,
  getExperimentMetricChartDescription,
  getExperimentMetricCharts,
} from "@phoenix/pages/dataset/metrics/chartCatalog";
import {
  type ExperimentSelection,
  RECENT_EXPERIMENT_SELECTION,
} from "@phoenix/pages/dataset/metrics/types";
import { useExperimentAnnotationMetricNames } from "@phoenix/pages/dataset/metrics/useExperimentAnnotationMetricNames";

/**
 * The "Charts" button that opens an experiment metric chart selector menu.
 * The menu content may suspend while it loads its options.
 */
export function ExperimentMetricsChartSelectorTrigger({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <MenuTrigger>
      <Button aria-label="Select metric charts">
        <Flex direction="row" alignItems="center" gap="size-100">
          <Icon svg={<Icons.BarChart />} />
          Charts
        </Flex>
      </Button>
      <MenuContainer placement="bottom end">
        <Suspense fallback={<Loading />}>{children}</Suspense>
      </MenuContainer>
    </MenuTrigger>
  );
}

/**
 * The store-connected chart selector shown above the experiments table. Reads
 * and writes the chart selection from the dataset store.
 */
export function ExperimentsMetricsChartSelector() {
  return (
    <ExperimentMetricsChartSelectorTrigger>
      <ConnectedChartSelectorMenu />
    </ExperimentMetricsChartSelectorTrigger>
  );
}

function ConnectedChartSelectorMenu() {
  const datasetId = useDatasetContext((state) => state.datasetId);
  const selectedChartKeys = useDatasetContext(
    (state) => state.experimentsMetricChartKeys
  );
  const setExperimentsMetricChartKeys = useDatasetContext(
    (state) => state.setExperimentsMetricChartKeys
  );
  const annotationNames = useExperimentAnnotationMetricNames(datasetId);
  return (
    <ExperimentChartSelectorMenu
      annotationNames={annotationNames}
      selectedChartKeys={selectedChartKeys}
      onSelectionChange={setExperimentsMetricChartKeys}
      experimentSelection={RECENT_EXPERIMENT_SELECTION}
    />
  );
}

/**
 * Feeds the experiment metric chart catalog, plus one chart per annotation,
 * into the generic {@link MetricsChartSelector}.
 */
export function ExperimentChartSelectorMenu({
  annotationNames,
  selectedChartKeys,
  onSelectionChange,
  experimentSelection,
}: {
  annotationNames: ReadonlyArray<string>;
  selectedChartKeys: ExperimentMetricChartKey[];
  onSelectionChange: (keys: ExperimentMetricChartKey[]) => void;
  /**
   * Which experiments the charts plot; picks the chart descriptions and
   * glyphs
   */
  experimentSelection: ExperimentSelection;
}) {
  const annotationKeys = annotationNames.map(
    getExperimentAnnotationMetricChartKey
  );
  const availableAnnotationKeys = new Set<ExperimentMetricChartKey>(
    annotationKeys
  );
  // Keep a persisted annotation visible if it was deleted so the
  // user can still deselect the empty chart.
  const unavailableSelectedAnnotationKeys = selectedChartKeys.filter(
    (key) =>
      getExperimentAnnotationName(key) != null &&
      !availableAnnotationKeys.has(key)
  );
  const charts = [
    ...EXPERIMENT_METRIC_CHARTS,
    ...getExperimentMetricCharts([
      ...annotationKeys,
      ...unavailableSelectedAnnotationKeys,
    ]),
  ];
  return (
    <MetricsChartSelector
      options={charts.map((chart) => ({
        ...chart,
        description: getExperimentMetricChartDescription({
          chart,
          experimentSelection,
        }),
        // Compared experiments have no inherent order, so every chart draws
        // them as bars
        chartType:
          experimentSelection.type === "recent" ? chart.chartType : "bar",
      }))}
      selectedKeys={selectedChartKeys}
      onSelectionChange={onSelectionChange}
    />
  );
}
