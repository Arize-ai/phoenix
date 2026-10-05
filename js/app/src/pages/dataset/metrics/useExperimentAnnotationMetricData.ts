import { graphql, readInlineData, useLazyLoadQuery } from "react-relay";

import type { ExperimentAnnotationMetric_experiment$key } from "./__generated__/ExperimentAnnotationMetric_experiment.graphql";
import type { ExperimentAnnotationMetricQuery } from "./__generated__/ExperimentAnnotationMetricQuery.graphql";
import type { useExperimentAnnotationMetricDataBaselineQuery } from "./__generated__/useExperimentAnnotationMetricDataBaselineQuery.graphql";
import {
  getExperimentMetricsQueryVariables,
  orderBySelection,
} from "./experimentMetricsSelection";
import type { ExperimentMetricsSelection } from "./types";

const experimentAnnotationMetricFragment = graphql`
  fragment ExperimentAnnotationMetric_experiment on Experiment
  @inline
  @argumentDefinitions(annotationName: { type: "String!" }) {
    id
    name
    sequenceNumber
    isBaseline
    annotationSummaries(annotationName: $annotationName) {
      annotationName
      meanScore
      labelFractions {
        label
        fraction
      }
    }
  }
`;

const experimentAnnotationMetricQuery = graphql`
  query ExperimentAnnotationMetricQuery(
    $id: ID!
    $count: Int!
    $filterIds: [ID!]
    $isSelection: Boolean!
    $annotationName: String!
  ) {
    dataset: node(id: $id) {
      ... on Dataset {
        # Query the same baseline field written by the baseline mutation so
        # set, replace, and clear operations update this chart through Relay.
        # A selection's base experiment is its reference instead.
        baselineExperiment @skip(if: $isSelection) {
          ...ExperimentAnnotationMetric_experiment
            @arguments(annotationName: $annotationName)
        }
        metricsExperiments: experiments(
          first: $count
          filterIds: $filterIds
          includeEphemeral: $isSelection
        ) {
          edges {
            experiment: node {
              ...ExperimentAnnotationMetric_experiment
                @arguments(annotationName: $annotationName)
            }
          }
        }
      }
    }
  }
`;

const experimentAnnotationMetricBaselineQuery = graphql`
  query useExperimentAnnotationMetricDataBaselineQuery($id: ID!) {
    dataset: node(id: $id) {
      ... on Dataset {
        baselineExperiment {
          id
        }
      }
    }
  }
`;

export type ExperimentAnnotationMetricDatum = {
  id: string;
  name: string;
  sequenceNumber: number;
  isBaseline: boolean;
  annotationSummaries: readonly {
    annotationName: string;
    meanScore: number | null;
    labelFractions: ReadonlyArray<{
      label: string;
      fraction: number;
    }>;
  }[];
};

export function useExperimentAnnotationMetricData({
  datasetId,
  annotationName,
  selection,
}: {
  datasetId: string;
  annotationName: string;
  /**
   * Loads exactly these experiments, base experiment first and as the
   * reference, instead of the dataset's most recent experiments.
   */
  selection?: ExperimentMetricsSelection;
}): {
  experiments: ExperimentAnnotationMetricDatum[];
  baselineExperiment: ExperimentAnnotationMetricDatum | null;
} {
  // The baseline mutation cannot refetch these runtime-argument summaries,
  // so key the query by the linked baseline to refetch them when it changes.
  // A selection's reference is its base experiment, so it never fetches the
  // dataset baseline.
  const baselineData =
    useLazyLoadQuery<useExperimentAnnotationMetricDataBaselineQuery>(
      experimentAnnotationMetricBaselineQuery,
      { id: datasetId },
      { fetchPolicy: selection == null ? "store-or-network" : "store-only" }
    );
  const data = useLazyLoadQuery<ExperimentAnnotationMetricQuery>(
    experimentAnnotationMetricQuery,
    {
      ...getExperimentMetricsQueryVariables({ datasetId, selection }),
      annotationName,
    },
    {
      fetchKey:
        selection == null
          ? (baselineData.dataset?.baselineExperiment?.id ?? "no-baseline")
          : "selection",
      fetchPolicy: "store-or-network",
    }
  );
  const edges = data.dataset.metricsExperiments?.edges ?? [];

  if (selection != null) {
    const experiments = orderBySelection({
      experiments: edges.map(({ experiment }) => {
        const datum = readExperimentAnnotationMetricDatum(experiment);
        return {
          ...datum,
          isBaseline: datum.id === selection.baseExperimentId,
        };
      }),
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
      : readExperimentAnnotationMetricDatum(data.dataset.baselineExperiment);
  const experiments = edges
    .map(({ experiment }) => readExperimentAnnotationMetricDatum(experiment))
    .sort((left, right) => left.sequenceNumber - right.sequenceNumber);
  return { experiments, baselineExperiment };
}

function readExperimentAnnotationMetricDatum(
  experiment: ExperimentAnnotationMetric_experiment$key
): ExperimentAnnotationMetricDatum {
  const data = readInlineData<ExperimentAnnotationMetric_experiment$key>(
    experimentAnnotationMetricFragment,
    experiment
  );
  return {
    id: data.id,
    name: data.name,
    sequenceNumber: data.sequenceNumber,
    isBaseline: data.isBaseline,
    // Missing from the store until the keyed refetch lands, despite the type.
    annotationSummaries: data.annotationSummaries ?? [],
  };
}
