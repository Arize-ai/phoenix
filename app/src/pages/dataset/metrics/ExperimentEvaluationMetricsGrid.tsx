import { css } from "@emotion/react";
import type { ReactNode } from "react";

import {
  ChartPanel,
  EvaluationMetricsChart,
  type EvaluationMetricsInputPoint,
  type EvaluationMetricsSeries,
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
  return (
    <ChartPanel title={series.name} subtitle="Evaluation results by experiment">
      <EvaluationMetricsChart
        series={series}
        xAxisProps={{
          ...getExperimentXAxisProps(baselineSequenceNumber),
          dataKey: "x",
        }}
        yAxisProps={experimentMetricsYAxisProps}
        syncId={EXPERIMENT_METRICS_CHART_SYNC_ID}
        additionalLegendItems={getExperimentBaselineLegendItems(
          series.hasLabels ? null : series.reference?.meanScore
        )}
        renderTooltipHeader={(point) => (
          <ExperimentMetricsTooltipHeader
            sequenceNumber={point.x}
            name={String(point.metadata.experimentName ?? "")}
            isBaseline={point.metadata.isBaseline === true}
          />
        )}
        renderReference={({ isMeanScoreHidden }) =>
          series.hasLabels ? (
            <ExperimentBaselineDistributionSeparator
              value={series.reference?.x}
            />
          ) : (
            <ExperimentBaselineValueLine
              value={isMeanScoreHidden ? null : series.reference?.meanScore}
            />
          )
        }
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
