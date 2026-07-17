import { css } from "@emotion/react";
import type { ReactNode } from "react";
import { Suspense, useState } from "react";

import { Loading } from "@phoenix/components";
import {
  ChartPanel,
  EvaluationMetricsChart,
  EvaluationMetricsLabelCountSelect,
  type EvaluationMetricsInputPoint,
  type EvaluationMetricsSeries,
  EvaluationMetricsViewToggle,
  getDefaultEvaluationMetricsView,
  getEmptyEvaluationMetricsSeries,
  MAX_EVALUATION_LABEL_COUNT,
  normalizeEvaluationMetrics,
} from "@phoenix/components/chart";
import { ErrorBoundary } from "@phoenix/components/exception";

import {
  ExperimentBaselineDistributionSeparator,
  ExperimentBaselineValueLine,
  getExperimentBaselineLegendItems,
} from "./ExperimentBaselineReference";
import { ExperimentMetricsTooltipHeader } from "./ExperimentMetricsTooltipHeader";
import {
  experimentMetricsYAxisProps,
  getExperimentXAxisProps,
} from "./experimentXAxisProps";
import { EXPERIMENT_METRICS_CHART_SYNC_ID } from "./types";
import {
  type ExperimentAnnotationMetricsDatum,
  useExperimentAnnotationMetricsData,
} from "./useExperimentMetricsData";

const evaluationGridCSS = css`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--global-dimension-size-200);

  @container (max-width: 900px) {
    grid-template-columns: minmax(0, 1fr);
  }
`;

export function ExperimentEvaluationMetricsGrid({
  datasetId,
  children,
}: {
  datasetId: string;
  children: ReactNode;
}) {
  return (
    <div css={evaluationGridCSS} data-testid="experiment-evaluation-grid">
      <ErrorBoundary>
        <Suspense fallback={<Loading />}>
          <ExperimentEvaluationMetricsPanels datasetId={datasetId} />
        </Suspense>
      </ErrorBoundary>
      {/* Share this grid so trailing half-width charts fill an odd final row. */}
      {children}
    </div>
  );
}

function ExperimentEvaluationMetricsPanels({
  datasetId,
}: {
  datasetId: string;
}) {
  const { evaluationSeries, baselineSequenceNumber } =
    useExperimentEvaluationMetricsSeries(datasetId);

  return (
    <>
      {evaluationSeries.map((series) => (
        <ExperimentEvaluationMetricsPanel
          key={series.name}
          series={series}
          baselineSequenceNumber={baselineSequenceNumber}
        />
      ))}
    </>
  );
}

export function useExperimentEvaluationMetricsSeries(datasetId: string) {
  const { experiments, baselineExperiment } =
    useExperimentAnnotationMetricsData(datasetId);
  const evaluationSeries = normalizeEvaluationMetrics({
    points: experiments.map(toEvaluationMetricsInputPoint),
    referencePoint:
      baselineExperiment == null
        ? undefined
        : toEvaluationMetricsInputPoint(baselineExperiment),
    // Every panel uses the same experiment categories even when an evaluation
    // only ran on a subset of the seven-experiment window.
    includeEmptyPoints: true,
  });

  return {
    evaluationSeries,
    baselineSequenceNumber: baselineExperiment?.sequenceNumber,
  };
}

export function ExperimentEvaluationMetricPanel({
  datasetId,
  evaluationName,
  fillHeight = false,
}: {
  datasetId: string;
  evaluationName: string;
  fillHeight?: boolean;
}) {
  return (
    <ErrorBoundary>
      <Suspense
        fallback={
          <ChartPanel
            title={evaluationName}
            subtitle="Evaluation results by experiment"
            fillHeight={fillHeight}
          >
            <Loading />
          </ChartPanel>
        }
      >
        <ExperimentEvaluationMetricPanelContent
          datasetId={datasetId}
          evaluationName={evaluationName}
          fillHeight={fillHeight}
        />
      </Suspense>
    </ErrorBoundary>
  );
}

function ExperimentEvaluationMetricPanelContent({
  datasetId,
  evaluationName,
  fillHeight,
}: {
  datasetId: string;
  evaluationName: string;
  fillHeight: boolean;
}) {
  const { evaluationSeries, baselineSequenceNumber } =
    useExperimentEvaluationMetricsSeries(datasetId);
  const series =
    evaluationSeries.find(({ name }) => name === evaluationName) ??
    getEmptyEvaluationMetricsSeries(evaluationName);
  return (
    <ExperimentEvaluationMetricsPanel
      series={series}
      baselineSequenceNumber={baselineSequenceNumber}
      fillHeight={fillHeight}
    />
  );
}

export function ExperimentEvaluationMetricsPanel({
  series,
  baselineSequenceNumber,
  fillHeight = false,
}: {
  series: EvaluationMetricsSeries;
  baselineSequenceNumber?: number;
  fillHeight?: boolean;
}) {
  const [view, setView] = useState(() =>
    getDefaultEvaluationMetricsView(series)
  );
  const maxLabelCount = Math.min(
    series.labels.length,
    MAX_EVALUATION_LABEL_COUNT
  );
  const [labelCount, setLabelCount] = useState(maxLabelCount);
  // A refetch can change the visible evaluation shape while preserving this
  // keyed panel, so fall back when its previous view is no longer available.
  const activeView = series.views.includes(view)
    ? view
    : getDefaultEvaluationMetricsView(series);
  const reference = series.referenceByView[activeView];
  const visibleLabelCount = Math.min(labelCount, maxLabelCount);
  const showLabelCountSelect =
    activeView === "labels" && series.labels.length > 5;
  const showViewToggle = series.views.length > 1;
  return (
    <ChartPanel
      title={series.name}
      subtitle="Evaluation results by experiment"
      fillHeight={fillHeight}
      headerActions={
        showViewToggle ? (
          <EvaluationMetricsViewToggle view={activeView} onChange={setView} />
        ) : undefined
      }
    >
      <EvaluationMetricsChart
        series={series}
        view={activeView}
        labelCount={visibleLabelCount}
        xAxisProps={{
          ...getExperimentXAxisProps(baselineSequenceNumber),
          dataKey: "x",
          // Recharts otherwise thins category ticks when panels get narrow.
          interval: 0,
        }}
        yAxisProps={experimentMetricsYAxisProps}
        syncId={EXPERIMENT_METRICS_CHART_SYNC_ID}
        additionalLegendItems={getExperimentBaselineLegendItems(
          activeView === "scores" ? reference?.meanScore : null
        )}
        legendTrailingContent={
          showLabelCountSelect ? (
            <EvaluationMetricsLabelCountSelect
              count={visibleLabelCount}
              maxCount={maxLabelCount}
              onChange={setLabelCount}
            />
          ) : undefined
        }
        renderTooltipHeader={(point) => (
          <ExperimentMetricsTooltipHeader
            sequenceNumber={point.x}
            name={String(point.metadata.experimentName ?? "")}
            isBaseline={point.metadata.isBaseline === true}
          />
        )}
        renderReference={({ isMeanScoreHidden }) => (
          <>
            <ExperimentBaselineDistributionSeparator
              value={activeView === "labels" ? reference?.x : null}
            />
            {activeView === "scores" && (
              <ExperimentBaselineValueLine
                value={isMeanScoreHidden ? null : reference?.meanScore}
              />
            )}
          </>
        )}
      />
    </ChartPanel>
  );
}

function toEvaluationMetricsInputPoint(
  experiment: ExperimentAnnotationMetricsDatum
): EvaluationMetricsInputPoint {
  return {
    x: experiment.sequenceNumber,
    metadata: {
      experimentName: experiment.name,
      isBaseline: experiment.isBaseline,
    },
    summaries: experiment.annotationSummaries.map((summary) => ({
      name: summary.name,
      meanScore: summary.meanScore,
      labelFractions: summary.labelFractions,
    })),
  };
}
