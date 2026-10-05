import { graphql, readInlineData, useLazyLoadQuery } from "react-relay";

import type { useExperimentMetricsData_experiment$key } from "./__generated__/useExperimentMetricsData_experiment.graphql";
import type { useExperimentMetricsDataQuery } from "./__generated__/useExperimentMetricsDataQuery.graphql";
import {
  getExperimentMetricsQueryVariables,
  orderBySelection,
} from "./experimentMetricsSelection";
import type { ExperimentMetricsSelection } from "./types";

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
    costDetailSummaryEntries {
      tokenType
      isPrompt
      value {
        tokens
      }
    }
  }
`;

/**
 * One query shared by every experiment metric chart so the whole metrics page
 * resolves from a single network request and Relay store entry. A selection
 * (`$isSelection`) loads exactly the selected experiments, ephemeral ones
 * included, and skips the dataset baseline since the base experiment is the
 * reference.
 */
export const experimentMetricsQuery = graphql`
  query useExperimentMetricsDataQuery(
    $id: ID!
    $count: Int!
    $filterIds: [ID!]
    $isSelection: Boolean!
  ) {
    dataset: node(id: $id) {
      ... on Dataset {
        baselineExperiment @skip(if: $isSelection) {
          ...useExperimentMetricsData_experiment
        }
        metricsExperiments: experiments(
          first: $count
          filterIds: $filterIds
          includeEphemeral: $isSelection
        ) {
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
  promptTokenDetails: ExperimentTokenDetail[];
  completionTokenDetails: ExperimentTokenDetail[];
};

type ExperimentTokenDetail = {
  tokenType: string;
  tokenCount: number | null;
};

function getExperimentTokenDetails({
  costDetailSummaryEntries,
  isPrompt,
}: {
  costDetailSummaryEntries: readonly {
    tokenType: string;
    isPrompt: boolean;
    value: {
      tokens: number | null;
    };
  }[];
  isPrompt: boolean;
}): ExperimentTokenDetail[] {
  return costDetailSummaryEntries
    .filter((entry) => entry.isPrompt === isPrompt)
    .map((entry) => ({
      tokenType: entry.tokenType,
      tokenCount: entry.value.tokens,
    }));
}

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
    promptTokenDetails: getExperimentTokenDetails({
      costDetailSummaryEntries: data.costDetailSummaryEntries,
      isPrompt: true,
    }),
    completionTokenDetails: getExperimentTokenDetails({
      costDetailSummaryEntries: data.costDetailSummaryEntries,
      isPrompt: false,
    }),
  };
}

/**
 * Loads the metrics for the dataset's most recent experiments, ordered by
 * ascending sequence number so charts read oldest to newest left to right.
 * Given a selection, loads the selected experiments instead, base experiment
 * first and as the reference, then the compare experiments in selection
 * order.
 */
export function useExperimentMetricsData({
  datasetId,
  selection,
}: {
  datasetId: string;
  selection?: ExperimentMetricsSelection;
}): {
  experiments: ExperimentMetricsDatum[];
  baselineExperiment: ExperimentMetricsDatum | null;
} {
  const data = useLazyLoadQuery<useExperimentMetricsDataQuery>(
    experimentMetricsQuery,
    getExperimentMetricsQueryVariables({ datasetId, selection }),
    { fetchPolicy: "store-or-network" }
  );

  if (selection != null) {
    const experiments = orderBySelection({
      experiments: (data.dataset.metricsExperiments?.edges ?? []).map(
        ({ experiment }): ExperimentMetricsDatum =>
          readExperimentMetricsDatum({
            experiment,
            baselineExperimentId: selection.baseExperimentId,
          })
      ),
      selection,
    });
    return {
      experiments,
      baselineExperiment:
        experiments.find((experiment) => experiment.isBaseline) ?? null,
    };
  }

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
