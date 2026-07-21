import { css } from "@emotion/react";
import type { ReactNode } from "react";
import { Suspense, useState } from "react";

import { Loading } from "@phoenix/components";
import {
  ChartPanel,
  EvaluationMetricsChart,
  type EvaluationMetricsInputPoint,
  type EvaluationMetricsSeries,
  EvaluationMetricsViewToggle,
  getDefaultEvaluationMetricsView,
  getEmptyEvaluationMetricsSeries,
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
  useExperimentAnnotationMetricNames,
  useExperimentEvaluationMetricData,
  type ExperimentEvaluationMetricDatum,
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
  const evaluationNames = useExperimentAnnotationMetricNames(datasetId);

  return (
    <>
      {evaluationNames.map((evaluationName) => (
        <ExperimentEvaluationMetricPanel
          key={evaluationName}
          datasetId={datasetId}
          evaluationName={evaluationName}
        />
      ))}
    </>
  );
}

export function useExperimentEvaluationMetricSeries({
  datasetId,
  evaluationName,
}: {
  datasetId: string;
  evaluationName: string;
}) {
  const { experiments, baselineExperiment } = useExperimentEvaluationMetricData(
    { datasetId, evaluationName }
  );
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
    series:
      evaluationSeries[0] ?? getEmptyEvaluationMetricsSeries(evaluationName),
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
  const { series, baselineSequenceNumber } =
    useExperimentEvaluationMetricSeries({ datasetId, evaluationName });
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
  // A refetch can change the visible evaluation shape while preserving this
  // keyed panel, so fall back when its previous view is no longer available.
  const activeView = series.views.includes(view)
    ? view
    : getDefaultEvaluationMetricsView(series);
  const reference = series.referenceByView[activeView];
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
  experiment: ExperimentEvaluationMetricDatum
): EvaluationMetricsInputPoint {
  return {
    x: experiment.sequenceNumber,
    metadata: {
      experimentName: experiment.name,
      isBaseline: experiment.isBaseline,
    },
    summaries: experiment.annotationSummaries.map((summary) => ({
      name: summary.annotationName,
      meanScore: summary.meanScore,
      labelFractions: summary.labelFractions,
    })),
  };
}
