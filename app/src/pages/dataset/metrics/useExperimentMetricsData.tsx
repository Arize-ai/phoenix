import type { ReactNode } from "react";
import { createContext, useContext, useEffect } from "react";
import type { PreloadedQuery } from "react-relay";
import {
  graphql,
  readInlineData,
  useLazyLoadQuery,
  usePreloadedQuery,
  useQueryLoader,
} from "react-relay";
import invariant from "tiny-invariant";

import { Loading } from "@phoenix/components";
import { EXPERIMENT_METRICS_EXPERIMENT_COUNT } from "@phoenix/pages/dataset/constants";

import type { ExperimentEvaluationMetric_experiment$key } from "./__generated__/ExperimentEvaluationMetric_experiment.graphql";
import type { ExperimentEvaluationMetricQuery } from "./__generated__/ExperimentEvaluationMetricQuery.graphql";
import type { useExperimentAnnotationMetricNamesQuery } from "./__generated__/useExperimentAnnotationMetricNamesQuery.graphql";
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
 * Keep the existing aggregate score summaries with the core metrics query.
 * Per-evaluation label distributions load independently in the filtered query below.
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

const experimentEvaluationMetricFragment = graphql`
  fragment ExperimentEvaluationMetric_experiment on Experiment
  @inline
  @argumentDefinitions(annotationName: { type: "String!" }) {
    id
    name
    sequenceNumber
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

const experimentEvaluationMetricQuery = graphql`
  query ExperimentEvaluationMetricQuery(
    $id: ID!
    $count: Int!
    $annotationName: String!
  ) {
    dataset: node(id: $id) {
      ... on Dataset {
        baselineExperiment {
          ...ExperimentEvaluationMetric_experiment
            @arguments(annotationName: $annotationName)
        }
        metricsExperiments: experiments(first: $count) {
          edges {
            experiment: node {
              ...ExperimentEvaluationMetric_experiment
                @arguments(annotationName: $annotationName)
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

export type ExperimentEvaluationMetricDatum = {
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

type ExperimentMetricsQueryContextValue = {
  datasetId: string;
  metricsQueryReference: PreloadedQuery<useExperimentMetricsDataQuery>;
};

const ExperimentMetricsQueryContext =
  createContext<ExperimentMetricsQueryContextValue | null>(null);

/** Loads and retains the core experiment metrics shared by the chart catalog. */
export function ExperimentMetricsDataProvider({
  datasetId,
  children,
}: {
  datasetId: string;
  children: ReactNode;
}) {
  const [metricsQueryReference, loadMetricsQuery] =
    useQueryLoader<useExperimentMetricsDataQuery>(experimentMetricsQuery);

  useEffect(() => {
    loadMetricsQuery(
      {
        id: datasetId,
        count: EXPERIMENT_METRICS_EXPERIMENT_COUNT,
      },
      { fetchPolicy: "store-or-network" }
    );
  }, [datasetId, loadMetricsQuery]);

  if (metricsQueryReference == null) {
    return <Loading />;
  }

  return (
    <ExperimentMetricsQueryContext.Provider
      value={{
        datasetId,
        metricsQueryReference,
      }}
    >
      {children}
    </ExperimentMetricsQueryContext.Provider>
  );
}

function useExperimentMetricsQueryContext(datasetId: string) {
  const context = useContext(ExperimentMetricsQueryContext);
  invariant(
    context,
    "Experiment metrics must be rendered inside their data provider"
  );
  invariant(
    context.datasetId === datasetId,
    "Experiment metrics provider does not match the requested dataset"
  );
  return context;
}

/**
 * Loads the metrics for the dataset's most recent experiments, ordered by
 * ascending sequence number so charts read oldest to newest left to right.
 */
export function useExperimentMetricsData(datasetId: string): {
  experiments: ExperimentMetricsDatum[];
  baselineExperiment: ExperimentMetricsDatum | null;
} {
  const { metricsQueryReference } = useExperimentMetricsQueryContext(datasetId);
  const data = usePreloadedQuery<useExperimentMetricsDataQuery>(
    experimentMetricsQuery,
    metricsQueryReference
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

export function useExperimentAnnotationMetricNames(
  datasetId: string
): ReadonlyArray<string> {
  // Annotation discovery is intentionally independent of metrics aggregation;
  // an annotation without chartable values can still be selected and render
  // the chart's empty state.
  const data = useLazyLoadQuery<useExperimentAnnotationMetricNamesQuery>(
    experimentAnnotationMetricNamesQuery,
    { id: datasetId },
    { fetchPolicy: "store-or-network" }
  );
  return (data.dataset.experimentAnnotationSummaries ?? []).map(
    ({ annotationName }) => annotationName
  );
}

export function useExperimentEvaluationMetricData({
  datasetId,
  evaluationName,
}: {
  datasetId: string;
  evaluationName: string;
}): {
  experiments: ExperimentEvaluationMetricDatum[];
  baselineExperiment: ExperimentEvaluationMetricDatum | null;
} {
  const data = useLazyLoadQuery<ExperimentEvaluationMetricQuery>(
    experimentEvaluationMetricQuery,
    {
      id: datasetId,
      count: EXPERIMENT_METRICS_EXPERIMENT_COUNT,
      annotationName: evaluationName,
    },
    { fetchPolicy: "store-or-network" }
  );
  const baselineExperiment =
    data.dataset.baselineExperiment == null
      ? null
      : readExperimentEvaluationMetricDatum({
          experiment: data.dataset.baselineExperiment,
          isBaseline: true,
        });
  const baselineExperimentId = baselineExperiment?.id;
  const experiments = (data.dataset.metricsExperiments?.edges ?? [])
    .map(({ experiment }) =>
      readExperimentEvaluationMetricDatum({
        experiment,
        isBaseline: false,
      })
    )
    .map((experiment) => ({
      ...experiment,
      isBaseline: experiment.id === baselineExperimentId,
    }))
    .sort((left, right) => left.sequenceNumber - right.sequenceNumber);
  return { experiments, baselineExperiment };
}

function readExperimentEvaluationMetricDatum({
  experiment,
  isBaseline,
}: {
  experiment: ExperimentEvaluationMetric_experiment$key;
  isBaseline: boolean;
}): ExperimentEvaluationMetricDatum {
  const data = readInlineData<ExperimentEvaluationMetric_experiment$key>(
    experimentEvaluationMetricFragment,
    experiment
  );
  return {
    id: data.id,
    name: data.name,
    sequenceNumber: data.sequenceNumber,
    isBaseline,
    annotationSummaries: data.annotationSummaries,
  };
}
