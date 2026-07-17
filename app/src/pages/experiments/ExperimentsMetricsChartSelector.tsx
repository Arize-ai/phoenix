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
  getExperimentEvaluationMetricChartKey,
  getExperimentEvaluationName,
  MAX_SELECTED_EXPERIMENT_METRIC_CHARTS,
} from "@phoenix/pages/dataset/constants";
import { EXPERIMENT_METRIC_CHARTS } from "@phoenix/pages/dataset/metrics/chartCatalog";
import { useExperimentAnnotationMetricNames } from "@phoenix/pages/dataset/metrics/useExperimentMetricsData";

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
  const evaluationNames = useExperimentAnnotationMetricNames(datasetId);
  const availableEvaluationKeys = new Set<ExperimentMetricChartKey>(
    evaluationNames.map(getExperimentEvaluationMetricChartKey)
  );
  // Keep a persisted evaluation visible if its annotation was deleted so the
  // user can still deselect the empty chart.
  const unavailableSelectedEvaluations = selectedChartKeys.flatMap((key) => {
    const evaluationName = getExperimentEvaluationName(key);
    return evaluationName == null || availableEvaluationKeys.has(key)
      ? []
      : [
          {
            key,
            name: evaluationName,
            description: "Evaluation results by experiment",
            chartType: "line" as const,
          },
        ];
  });
  const evaluationOptions = evaluationNames.map((evaluationName) => ({
    key: getExperimentEvaluationMetricChartKey(evaluationName),
    name: evaluationName,
    description: "Evaluation results by experiment",
    // The lightweight catalog query intentionally omits full series data, so
    // use a neutral chart glyph until the selected chart reveals its view.
    chartType: "line" as const,
  }));
  return (
    <MetricsChartSelector
      options={[
        ...EXPERIMENT_METRIC_CHARTS,
        ...evaluationOptions,
        ...unavailableSelectedEvaluations,
      ]}
      selectedKeys={selectedChartKeys}
      maxSelected={MAX_SELECTED_EXPERIMENT_METRIC_CHARTS}
      onSelectionChange={onSelectionChange}
    />
  );
}
