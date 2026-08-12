import { graphql, readInlineData, useLazyLoadQuery } from "react-relay";

import { EXPERIMENT_METRICS_EXPERIMENT_COUNT } from "@phoenix/pages/dataset/constants";

import type { useExperimentMetricsData_experiment$key } from "./__generated__/useExperimentMetricsData_experiment.graphql";
import type { useExperimentMetricsDataQuery } from "./__generated__/useExperimentMetricsDataQuery.graphql";

const experimentMetricsExperimentFragment = graphql`
  fragment useExperimentMetricsData_experiment on Experiment @inline {
    id
    name
    sequenceNumber
    averageRunLatencyMs
    errorRate
    runCount
    annotationSummaries {
      annotationName
      meanScore
    }
    costSummary {
      prompt {
        tokens
        cost
      }
      completion {
        tokens
        cost
      }
      total {
        tokens
        cost
      }
    }
  }
`;

/**
 * One query shared by every experiment metric chart so the whole metrics page
 * resolves from a single network request and Relay store entry.
 */
export const experimentMetricsQuery = graphql`
  query useExperimentMetricsDataQuery($id: ID!, $count: Int!) {
    dataset: node(id: $id) {
      ... on Dataset {
        baselineExperiment {
          ...useExperimentMetricsData_experiment
        }
        metricsExperiments: experiments(first: $count) {
          edges {
            experiment: node {
              ...useExperimentMetricsData_experiment
            }
          }
        }
      }
    }
  }
`;

export type ExperimentMetricsDatum = {
  id: string;
  name: string;
  sequenceNumber: number;
  isBaseline: boolean;
  averageRunLatencyMs: number | null;
  errorRate: number | null;
  runCount: number;
  annotationSummaries: readonly {
    annotationName: string;
    meanScore: number | null;
  }[];
  promptCost: number | null;
  completionCost: number | null;
  totalCost: number | null;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
};

function readExperimentMetricsDatum({
  experiment,
  baselineExperimentId,
}: {
  experiment: useExperimentMetricsData_experiment$key;
  baselineExperimentId?: string;
}): ExperimentMetricsDatum {
  const data = readInlineData<useExperimentMetricsData_experiment$key>(
    experimentMetricsExperimentFragment,
    experiment
  );
  return {
    id: data.id,
    name: data.name,
    sequenceNumber: data.sequenceNumber,
    isBaseline: data.id === baselineExperimentId,
    averageRunLatencyMs: data.averageRunLatencyMs,
    errorRate: data.errorRate,
    runCount: data.runCount,
    annotationSummaries: data.annotationSummaries,
    promptCost: data.costSummary.prompt.cost,
    completionCost: data.costSummary.completion.cost,
    totalCost: data.costSummary.total.cost,
    promptTokens: data.costSummary.prompt.tokens,
    completionTokens: data.costSummary.completion.tokens,
    totalTokens: data.costSummary.total.tokens,
  };
}

/**
 * Loads the metrics for the dataset's most recent experiments, ordered by
 * ascending sequence number so charts read oldest to newest left to right.
 */
export function useExperimentMetricsData(datasetId: string): {
  experiments: ExperimentMetricsDatum[];
  baselineExperiment: ExperimentMetricsDatum | null;
} {
  const data = useLazyLoadQuery<useExperimentMetricsDataQuery>(
    experimentMetricsQuery,
    { id: datasetId, count: EXPERIMENT_METRICS_EXPERIMENT_COUNT },
    { fetchPolicy: "store-or-network" }
  );

  const baselineExperiment =
    data.dataset.baselineExperiment == null
      ? null
      : {
          ...readExperimentMetricsDatum({
            experiment: data.dataset.baselineExperiment,
          }),
          isBaseline: true,
        };
  const baselineExperimentId = baselineExperiment?.id;
  const experiments = (data.dataset.metricsExperiments?.edges ?? [])
    .map(
      ({ experiment }): ExperimentMetricsDatum =>
        readExperimentMetricsDatum({
          experiment,
          baselineExperimentId,
        })
    )
    .sort((a, b) => a.sequenceNumber - b.sequenceNumber);

  return {
    experiments,
    baselineExperiment,
  };
}
