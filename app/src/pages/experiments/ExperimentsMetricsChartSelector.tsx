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
  EXPERIMENT_ANNOTATION_METRIC_CHART_DESCRIPTION,
  type ExperimentMetricChartKey,
  getExperimentAnnotationMetricChartKey,
  getExperimentAnnotationName,
  MAX_SELECTED_EXPERIMENT_METRIC_CHARTS,
} from "@phoenix/pages/dataset/constants";
import { EXPERIMENT_METRIC_CHARTS } from "@phoenix/pages/dataset/metrics/chartCatalog";
import { useExperimentAnnotationMetricNames } from "@phoenix/pages/dataset/metrics/useExperimentAnnotationMetricsData";

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
  const availableAnnotationKeys = new Set<ExperimentMetricChartKey>(
    annotationNames.map(getExperimentAnnotationMetricChartKey)
  );
  // Keep a persisted annotation visible if it was deleted so the
  // user can still deselect the empty chart.
  const unavailableSelectedAnnotations = selectedChartKeys.flatMap((key) => {
    const annotationName = getExperimentAnnotationName(key);
    return annotationName == null || availableAnnotationKeys.has(key)
      ? []
      : [
          {
            key,
            name: annotationName,
            description: EXPERIMENT_ANNOTATION_METRIC_CHART_DESCRIPTION,
            chartType: "line" as const,
          },
        ];
  });
  const annotationOptions = annotationNames.map((annotationName) => ({
    key: getExperimentAnnotationMetricChartKey(annotationName),
    name: annotationName,
    description: EXPERIMENT_ANNOTATION_METRIC_CHART_DESCRIPTION,
    // The lightweight catalog query intentionally omits full series data, so
    // use a neutral chart glyph until the selected chart reveals its view.
    chartType: "line" as const,
  }));
  return (
    <MetricsChartSelector
      options={[
        ...EXPERIMENT_METRIC_CHARTS,
        ...annotationOptions,
        ...unavailableSelectedAnnotations,
      ]}
      selectedKeys={selectedChartKeys}
      maxSelected={MAX_SELECTED_EXPERIMENT_METRIC_CHARTS}
      onSelectionChange={onSelectionChange}
    />
  );
}
