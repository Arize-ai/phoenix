import { css } from "@emotion/react";
import type { ReactNode } from "react";

import {
  ChartPanel,
  EvaluationMetricsChart,
  normalizeEvaluationMetrics,
} from "@phoenix/components/chart";

import { ExperimentMetricsTooltipHeader } from "./ExperimentMetricsTooltipHeader";
import {
  experimentMetricsYAxisProps,
  getExperimentXAxisProps,
} from "./experimentXAxisProps";
import { EXPERIMENT_METRICS_CHART_SYNC_ID } from "./types";
import { useExperimentMetricsData } from "./useExperimentMetricsData";

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
  const evaluationSeries = normalizeEvaluationMetrics(
    experiments.map((experiment) => ({
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
    }))
  );

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
            renderTooltipHeader={(point) => (
              <ExperimentMetricsTooltipHeader
                sequenceNumber={point.x}
                name={String(point.metadata.experimentName ?? "")}
                isBaseline={point.metadata.isBaseline === true}
              />
            )}
          />
        </ChartPanel>
      ))}
      {children}
    </div>
  );
}
