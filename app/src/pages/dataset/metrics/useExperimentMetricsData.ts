import { graphql, useLazyLoadQuery } from "react-relay";

import { EXPERIMENT_METRICS_EXPERIMENT_COUNT } from "@phoenix/pages/dataset/constants";

import type { useExperimentMetricsDataQuery } from "./__generated__/useExperimentMetricsDataQuery.graphql";

/**
 * One query shared by every experiment metric chart so the whole metrics page
 * resolves from a single network request and Relay store entry.
 */
export const experimentMetricsQuery = graphql`
  query useExperimentMetricsDataQuery($id: ID!, $count: Int!) {
    dataset: node(id: $id) {
      ... on Dataset {
        metricsExperiments: experiments(first: $count) {
          edges {
            experiment: node {
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
          }
        }
      }
    }
  }
`;

export type ExperimentMetricsDatum = {
  name: string;
  sequenceNumber: number;
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

/**
 * Loads the metrics for the dataset's most recent experiments, ordered by
 * ascending sequence number so charts read oldest to newest left to right.
 */
export function useExperimentMetricsData(datasetId: string): {
  experiments: ExperimentMetricsDatum[];
} {
  const data = useLazyLoadQuery<useExperimentMetricsDataQuery>(
    experimentMetricsQuery,
    { id: datasetId, count: EXPERIMENT_METRICS_EXPERIMENT_COUNT },
    { fetchPolicy: "store-or-network" }
  );

  const experiments = (data.dataset.metricsExperiments?.edges ?? [])
    .map(
      ({ experiment }): ExperimentMetricsDatum => ({
        name: experiment.name,
        sequenceNumber: experiment.sequenceNumber,
        averageRunLatencyMs: experiment.averageRunLatencyMs,
        errorRate: experiment.errorRate,
        runCount: experiment.runCount,
        annotationSummaries: experiment.annotationSummaries,
        promptCost: experiment.costSummary.prompt.cost,
        completionCost: experiment.costSummary.completion.cost,
        totalCost: experiment.costSummary.total.cost,
        promptTokens: experiment.costSummary.prompt.tokens,
        completionTokens: experiment.costSummary.completion.tokens,
        totalTokens: experiment.costSummary.total.tokens,
      })
    )
    .sort((a, b) => a.sequenceNumber - b.sequenceNumber);

  return { experiments };
}
