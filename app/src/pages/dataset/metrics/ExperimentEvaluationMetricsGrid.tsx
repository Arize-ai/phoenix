import { css } from "@emotion/react";
import type { ReactNode } from "react";

import {
  ChartPanel,
  EvaluationMetricsChart,
  type EvaluationMetricsInputPoint,
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
        <ChartPanel
          key={series.name}
          title={series.name}
          subtitle="Evaluation results by experiment"
        >
          <EvaluationMetricsChart
            series={series}
            xAxisProps={{
              ...getExperimentXAxisProps(baselineExperiment?.sequenceNumber),
              dataKey: "x",
            }}
            yAxisProps={experimentMetricsYAxisProps}
            syncId={EXPERIMENT_METRICS_CHART_SYNC_ID}
            additionalLegendItems={getExperimentBaselineLegendItems(
              series.kind === "score" ? series.reference?.meanScore : null
            )}
            renderTooltipHeader={(point) => (
              <ExperimentMetricsTooltipHeader
                sequenceNumber={point.x}
                name={String(point.metadata.experimentName ?? "")}
                isBaseline={point.metadata.isBaseline === true}
              />
            )}
            renderReference={({ isMeanScoreHidden }) =>
              series.kind === "score" ? (
                <ExperimentBaselineValueLine
                  value={isMeanScoreHidden ? null : series.reference?.meanScore}
                />
              ) : (
                <ExperimentBaselineDistributionSeparator
                  value={series.reference?.x}
                />
              )
            }
          />
        </ChartPanel>
      ))}
      {/* Share this grid so trailing half-width charts fill an odd final row. */}
      {children}
    </div>
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
      count: summary.count,
      scoreCount: summary.scoreCount,
      labelCount: summary.labelCount,
      meanScore: summary.meanScore,
      labelFractions: summary.labelFractions,
    })),
  };
}
