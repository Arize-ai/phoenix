import { css } from "@emotion/react";
import { useParams } from "react-router";
import invariant from "tiny-invariant";

import { EdgeFade } from "@phoenix/components";
import { ChartPanelSkeleton } from "@phoenix/components/chart";
import type { ExperimentMetricChartKey } from "@phoenix/pages/dataset/constants";
import { ExperimentsEmpty } from "@phoenix/pages/experiments/ExperimentsEmpty";

import { getExperimentMetricChart } from "./chartCatalog";
import {
  ExperimentAnnotationMetricsGrid,
  ExperimentAnnotationMetricsGridSkeleton,
} from "./ExperimentAnnotationMetricsGrid";
import { RECENT_EXPERIMENT_SELECTION } from "./types";
import { useExperimentMetricsData } from "./useExperimentMetricsData";

const OVERVIEW_METRIC_CHARTS: ExperimentMetricChartKey[] = [
  "annotation_scores",
  "latency",
  "cost",
];

const TRAILING_METRIC_CHARTS: ExperimentMetricChartKey[] = [
  "tokens",
  "error_rate",
];

const metricsPageCSS = css`
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  /* Scrolls in both directions: the rows hold their charts at a
     readable width rather than shrinking to fit a narrow window */
  overflow: auto;
`;

const metricsPageChartsCSS = css`
  display: flex;
  flex-direction: column;
  container-type: inline-size;
  gap: var(--global-dimension-size-200);
  padding: var(--global-dimension-size-200);
  /* The widest row's charts at their minimum width. Every row stretches
     to it, so a scrolled page keeps its charts aligned in a column. */
  min-width: min-content;
`;

export function DatasetMetricsPage() {
  const { datasetId } = useParams();
  invariant(datasetId, "datasetId is required to view experiment metrics");
  const { experiments } = useExperimentMetricsData({
    datasetId,
    experimentSelection: RECENT_EXPERIMENT_SELECTION,
  });

  if (experiments.length === 0) {
    return <ExperimentsEmpty />;
  }

  return (
    <section aria-label="Experiment metrics" css={metricsPageCSS}>
      <div css={metricsPageChartsCSS}>
        {OVERVIEW_METRIC_CHARTS.map((chartKey) => (
          <MetricPanel
            key={chartKey}
            datasetId={datasetId}
            chartKey={chartKey}
          />
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

/**
 * A loading placeholder for the metrics page: a panel skeleton for each
 * overview chart, then the half-width grid of annotation and trailing charts.
 */
export function DatasetMetricsPageSkeleton() {
  return (
    <EdgeFade
      edge="bottom"
      role="status"
      aria-label="loading"
      css={metricsPageCSS}
    >
      <div css={metricsPageChartsCSS} aria-hidden>
        {OVERVIEW_METRIC_CHARTS.map((chartKey) => (
          <ChartPanelSkeleton key={chartKey} />
        ))}
        <ExperimentAnnotationMetricsGridSkeleton />
      </div>
    </EdgeFade>
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
  return (
    <Panel
      datasetId={datasetId}
      experimentSelection={RECENT_EXPERIMENT_SELECTION}
      annotationName={annotationName}
    />
  );
}
