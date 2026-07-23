import { css } from "@emotion/react";
import { useParams } from "react-router";
import invariant from "tiny-invariant";

import { Flex } from "@phoenix/components";
import type { ExperimentMetricChartKey } from "@phoenix/pages/dataset/constants";
import { ExperimentsEmpty } from "@phoenix/pages/experiments/ExperimentsEmpty";

import { getExperimentMetricChart } from "./chartCatalog";
import { ExperimentAnnotationMetricsGrid } from "./ExperimentAnnotationMetricsGrid";
import { useExperimentMetricsData } from "./useExperimentMetricsData";

/**
 * The overview charts shown above the per-annotation grid. Each row is full
 * width so the existing aggregate metrics remain grouped together.
 */
const METRIC_PAGE_ROWS: ExperimentMetricChartKey[][] = [
  ["annotation_scores"],
  ["latency"],
  ["cost"],
];

const TRAILING_METRIC_CHARTS: ExperimentMetricChartKey[] = [
  "tokens",
  "error_rate",
];

export function DatasetMetricsPage() {
  const { datasetId } = useParams();
  invariant(datasetId, "datasetId is required to view experiment metrics");

  return <DatasetMetricsPageContent datasetId={datasetId} />;
}

function DatasetMetricsPageContent({ datasetId }: { datasetId: string }) {
  const { experiments } = useExperimentMetricsData(datasetId);

  if (experiments.length === 0) {
    return <ExperimentsEmpty />;
  }

  return (
    <section
      aria-label="Experiment metrics"
      css={css`
        width: 100%;
        height: 100%;
        box-sizing: border-box;
        overflow-y: auto;
      `}
    >
      <div
        css={css`
          display: flex;
          flex-direction: column;
          container-type: inline-size;
          gap: var(--global-dimension-size-200);
          padding: var(--global-dimension-size-200);
        `}
      >
        {METRIC_PAGE_ROWS.map((row) => (
          <MetricRow datasetId={datasetId} row={row} key={row.join("+")} />
        ))}
        <ExperimentAnnotationMetricsGrid datasetId={datasetId}>
          {TRAILING_METRIC_CHARTS.map((chartKey) => (
            <MetricPanel
              key={chartKey}
              datasetId={datasetId}
              chartKey={chartKey}
            />
          ))}
        </ExperimentAnnotationMetricsGrid>
      </div>
    </section>
  );
}

function MetricRow({
  datasetId,
  row,
}: {
  datasetId: string;
  row: ExperimentMetricChartKey[];
}) {
  return (
    <Flex direction="row" gap="size-200">
      {row.map((chartKey) => {
        return (
          <MetricPanel
            key={chartKey}
            datasetId={datasetId}
            chartKey={chartKey}
          />
        );
      })}
    </Flex>
  );
}

function MetricPanel({
  datasetId,
  chartKey,
}: {
  datasetId: string;
  chartKey: ExperimentMetricChartKey;
}) {
  const { annotationName, Panel } = getExperimentMetricChart(chartKey);
  return <Panel datasetId={datasetId} annotationName={annotationName} />;
}
