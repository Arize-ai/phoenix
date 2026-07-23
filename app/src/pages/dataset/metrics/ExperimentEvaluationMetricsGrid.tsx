import { css } from "@emotion/react";
import type { ReactNode } from "react";
import { useState } from "react";

import {
  ChartPanel,
  EvaluationMetricsChart,
  type EvaluationMetricsInputPoint,
  type EvaluationMetricsSeries,
  EvaluationMetricsViewToggle,
  getDefaultEvaluationMetricsView,
  normalizeEvaluationMetrics,
} from "@phoenix/components/chart";

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
  type ExperimentMetricsDatum,
  useExperimentMetricsData,
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
  const { experiments, baselineExperiment } =
    useExperimentMetricsData(datasetId);
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

  return (
    <div css={evaluationGridCSS} data-testid="experiment-evaluation-grid">
      {evaluationSeries.map((series) => (
        <ExperimentEvaluationMetricsPanel
          key={series.name}
          series={series}
          baselineSequenceNumber={baselineExperiment?.sequenceNumber}
        />
      ))}
      {/* Share this grid so trailing half-width charts fill an odd final row. */}
      {children}
    </div>
  );
}

function ExperimentEvaluationMetricsPanel({
  series,
  baselineSequenceNumber,
}: {
  series: EvaluationMetricsSeries;
  baselineSequenceNumber?: number;
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
  // Score baselines serve two purposes: the bar aligns categories across
  // panels, while the horizontal line supports value comparison.

  return (
    <ChartPanel
      title={series.name}
      subtitle="Evaluation results by experiment"
      headerActions={
        series.views.length > 1 ? (
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
            <ExperimentBaselineDistributionSeparator value={reference?.x} />
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
  experiment: ExperimentMetricsDatum
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
