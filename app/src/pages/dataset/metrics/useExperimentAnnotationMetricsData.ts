import { graphql, readInlineData, useLazyLoadQuery } from "react-relay";

import { EXPERIMENT_METRICS_EXPERIMENT_COUNT } from "@phoenix/pages/dataset/constants";

import type { ExperimentAnnotationMetric_experiment$key } from "./__generated__/ExperimentAnnotationMetric_experiment.graphql";
import type { ExperimentAnnotationMetricQuery } from "./__generated__/ExperimentAnnotationMetricQuery.graphql";
import type { useExperimentAnnotationMetricNamesQuery } from "./__generated__/useExperimentAnnotationMetricNamesQuery.graphql";

const experimentAnnotationMetricNamesQuery = graphql`
  query useExperimentAnnotationMetricNamesQuery($id: ID!) {
    dataset: node(id: $id) {
      ... on Dataset {
        experimentAnnotationSummaries {
          annotationName
        }
      }
    }
  }
`;

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
    $annotationName: String!
  ) {
    dataset: node(id: $id) {
      ... on Dataset {
        # Query the same baseline field written by the baseline mutation so
        # set, replace, and clear operations update this chart through Relay.
        baselineExperiment {
          ...ExperimentAnnotationMetric_experiment
            @arguments(annotationName: $annotationName)
        }
        metricsExperiments: experiments(first: $count) {
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

export function useExperimentAnnotationMetricNames(
  datasetId: string
): ReadonlyArray<string> {
  // Annotation discovery intentionally omits per-experiment aggregates so
  // opening the chart selector does not fetch every chart's metrics.
  const data = useLazyLoadQuery<useExperimentAnnotationMetricNamesQuery>(
    experimentAnnotationMetricNamesQuery,
    { id: datasetId },
    { fetchPolicy: "store-or-network" }
  );
  return (data.dataset.experimentAnnotationSummaries ?? []).map(
    ({ annotationName }) => annotationName
  );
}

export function useExperimentAnnotationMetricData({
  datasetId,
  annotationName,
  fetchKey,
}: {
  datasetId: string;
  annotationName: string;
  fetchKey?: number;
}): {
  experiments: ExperimentAnnotationMetricDatum[];
  baselineExperiment: ExperimentAnnotationMetricDatum | null;
} {
  const data = useLazyLoadQuery<ExperimentAnnotationMetricQuery>(
    experimentAnnotationMetricQuery,
    {
      id: datasetId,
      count: EXPERIMENT_METRICS_EXPERIMENT_COUNT,
      annotationName,
    },
    { fetchKey, fetchPolicy: "store-or-network" }
  );
  const baselineExperiment =
    data.dataset.baselineExperiment == null
      ? null
      : readExperimentAnnotationMetricDatum(data.dataset.baselineExperiment);
  const experiments = (data.dataset.metricsExperiments?.edges ?? [])
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
    annotationSummaries: data.annotationSummaries,
  };
}
