import { graphql, readInlineData, useLazyLoadQuery } from "react-relay";

import type { ExperimentAnnotationMetric_experiment$key } from "./__generated__/ExperimentAnnotationMetric_experiment.graphql";
import type { ExperimentAnnotationMetricQuery } from "./__generated__/ExperimentAnnotationMetricQuery.graphql";
import type { useExperimentAnnotationMetricDataBaselineQuery } from "./__generated__/useExperimentAnnotationMetricDataBaselineQuery.graphql";
import {
  getExperimentMetricsQueryVariables,
  orderByComparedSelection,
} from "./experimentSelection";
import type { ExperimentSelection } from "./types";

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
    $isComparedSelection: Boolean!
    $annotationName: String!
  ) {
    dataset: node(id: $id) {
      ... on Dataset {
        # Query the same baseline field written by the baseline mutation so
        # set, replace, and clear operations update this chart through Relay.
        # A comparison's base experiment is its reference instead.
        baselineExperiment @skip(if: $isComparedSelection) {
          ...ExperimentAnnotationMetric_experiment
            @arguments(annotationName: $annotationName)
        }
        metricsExperiments: experiments(
          first: $count
          filterIds: $filterIds
          includeEphemeral: $isComparedSelection
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
  experimentSelection,
}: {
  datasetId: string;
  annotationName: string;
  /**
   * Which experiments to load. A compared selection loads exactly the compared
   * experiments, base experiment first and as the reference.
   */
  experimentSelection: ExperimentSelection;
}): {
  experiments: ExperimentAnnotationMetricDatum[];
  baselineExperiment: ExperimentAnnotationMetricDatum | null;
} {
  // The baseline mutation cannot refetch these runtime-argument summaries,
  // so key the query by the linked baseline to refetch them when it changes.
  // A compared selection's reference is its base experiment, so it never
  // fetches the
  // dataset baseline.
  const baselineData =
    useLazyLoadQuery<useExperimentAnnotationMetricDataBaselineQuery>(
      experimentAnnotationMetricBaselineQuery,
      { id: datasetId },
      {
        fetchPolicy:
          experimentSelection.type === "recent"
            ? "store-or-network"
            : "store-only",
      }
    );
  const data = useLazyLoadQuery<ExperimentAnnotationMetricQuery>(
    experimentAnnotationMetricQuery,
    {
      ...getExperimentMetricsQueryVariables({ datasetId, experimentSelection }),
      annotationName,
    },
    {
      fetchKey:
        experimentSelection.type === "recent"
          ? (baselineData.dataset?.baselineExperiment?.id ?? "no-baseline")
          : "compared",
      fetchPolicy: "store-or-network",
    }
  );
  const edges = data.dataset.metricsExperiments?.edges ?? [];

  if (experimentSelection.type === "compared") {
    const experiments = orderByComparedSelection({
      experiments: edges.map(({ experiment }) => {
        const datum = readExperimentAnnotationMetricDatum(experiment);
        return {
          ...datum,
          isBaseline: datum.id === experimentSelection.baseExperimentId,
        };
      }),
      experimentSelection,
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
