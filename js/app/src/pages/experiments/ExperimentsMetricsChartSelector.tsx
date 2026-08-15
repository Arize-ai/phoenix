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
  getExperimentMetricCharts,
} from "@phoenix/pages/dataset/metrics/chartCatalog";
import { useExperimentAnnotationMetricNames } from "@phoenix/pages/dataset/metrics/useExperimentAnnotationMetricNames";

/**
 * The store-connected chart selector shown above the experiments table. Reads
 * and writes the chart selection from the dataset store, and feeds the
 * experiment metric chart catalog into the generic
 * {@link MetricsChartSelector}.
 */
export function ExperimentsMetricsChartSelector() {
  return (
    <MenuTrigger>
      <Button aria-label="Select metric charts">
        <Flex direction="row" alignItems="center" gap="size-100">
          <Icon svg={<Icons.BarChart />} />
          Charts
        </Flex>
      </Button>
      <MenuContainer placement="bottom end">
        <ConnectedChartSelectorMenu />
      </MenuContainer>
    </MenuTrigger>
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
  return (
    <Suspense fallback={<Loading />}>
      <ExperimentChartSelectorMenu
        datasetId={datasetId}
        selectedChartKeys={selectedChartKeys}
        onSelectionChange={setExperimentsMetricChartKeys}
      />
    </Suspense>
  );
}

function ExperimentChartSelectorMenu({
  datasetId,
  selectedChartKeys,
  onSelectionChange,
}: {
  datasetId: string;
  selectedChartKeys: ExperimentMetricChartKey[];
  onSelectionChange: (keys: ExperimentMetricChartKey[]) => void;
}) {
  const annotationNames = useExperimentAnnotationMetricNames(datasetId);
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
  return (
    <MetricsChartSelector
      options={[
        ...EXPERIMENT_METRIC_CHARTS,
        ...getExperimentMetricCharts([
          ...annotationKeys,
          ...unavailableSelectedAnnotationKeys,
        ]),
      ]}
      selectedKeys={selectedChartKeys}
      onSelectionChange={onSelectionChange}
    />
  );
}
