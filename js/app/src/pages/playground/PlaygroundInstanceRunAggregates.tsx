import { useMemo } from "react";

import type { AnnotationConfig } from "@phoenix/components/annotation";
import type { ExecutionState } from "@phoenix/components/core/types";
import {
  ExperimentAnnotationAggregates,
  ExperimentCostAndLatencySummary,
  type ExperimentCostAndLatencySummaryExperiment,
} from "@phoenix/components/experiment";
import type { AnnotationSummary } from "@phoenix/components/experiment/ExperimentAnnotationAggregates";

import { usePlaygroundDatasetExamplesTableContext } from "./PlaygroundDatasetExamplesTableContext";

function getExecutionState({
  hasData,
  isRunning,
  experimentId,
}: {
  hasData: boolean;
  isRunning: boolean;
  experimentId: string | null | undefined;
}): ExecutionState {
  if (hasData) return "complete";
  if (isRunning) return "running";
  if (experimentId != null) return "complete";
  return "idle";
}

/**
 * The stat strip under a playground column's header: average latency, tokens
 * and cost per run, then the average score of each annotation in
 * `annotationConfigs`, aggregated over every run of the instance as results
 * stream in.
 */
export function PlaygroundInstanceRunAggregates({
  instanceId,
  experimentId,
  isRunning,
  annotationConfigs,
}: {
  instanceId: number;
  experimentId: string | null | undefined;
  isRunning: boolean;
  annotationConfigs: readonly AnnotationConfig[];
}) {
  const annotationAggregateMetrics = usePlaygroundDatasetExamplesTableContext(
    (state) => state.runAnnotationAggregateMetrics[instanceId] ?? null
  );
  const costAggregateMetrics = usePlaygroundDatasetExamplesTableContext(
    (state) => state.runCostAggregateMetrics[instanceId] ?? null
  );
  const annotationSummaries = useMemo<AnnotationSummary[]>(() => {
    if (annotationAggregateMetrics == null) {
      return [];
    }
    return Object.entries(annotationAggregateMetrics).map(
      ([annotationName, metric]) => ({
        annotationName,
        meanScore: metric.count > 0 ? metric.sum / metric.count : null,
      })
    );
  }, [annotationAggregateMetrics]);
  const costSummary =
    useMemo<ExperimentCostAndLatencySummaryExperiment | null>(() => {
      const resolvedExperimentId = experimentId ?? null;
      if (
        resolvedExperimentId == null ||
        costAggregateMetrics == null ||
        costAggregateMetrics.runCount === 0
      ) {
        return null;
      }
      return {
        id: resolvedExperimentId,
        averageRunLatencyMs:
          costAggregateMetrics.latencyCount > 0
            ? costAggregateMetrics.latencySum /
              costAggregateMetrics.latencyCount
            : null,
        runCount: costAggregateMetrics.runCount,
        costSummary: {
          total: {
            cost:
              costAggregateMetrics.costCount > 0
                ? costAggregateMetrics.costSum
                : null,
            tokens:
              costAggregateMetrics.tokenCountCount > 0
                ? costAggregateMetrics.tokenCountSum
                : null,
          },
        },
      };
    }, [experimentId, costAggregateMetrics]);

  const costExecutionState = getExecutionState({
    hasData: costSummary != null,
    isRunning,
    experimentId,
  });

  const annotationExecutionState = getExecutionState({
    hasData: annotationSummaries.length > 0,
    isRunning,
    experimentId,
  });

  return (
    <>
      <ExperimentCostAndLatencySummary
        executionState={costExecutionState}
        experiment={costSummary}
      />
      <ExperimentAnnotationAggregates
        executionState={annotationExecutionState}
        annotationConfigs={annotationConfigs}
        annotationSummaries={annotationSummaries}
      />
    </>
  );
}
