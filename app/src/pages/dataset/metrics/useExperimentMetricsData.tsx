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

import type { useExperimentAnnotationMetricNamesQuery } from "./__generated__/useExperimentAnnotationMetricNamesQuery.graphql";
import type { useExperimentAnnotationMetricsData_dataPoint$key } from "./__generated__/useExperimentAnnotationMetricsData_dataPoint.graphql";
import type { useExperimentAnnotationMetricsDataQuery } from "./__generated__/useExperimentAnnotationMetricsDataQuery.graphql";
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
 * Core experiment metrics intentionally exclude annotations so these charts
 * can render while the independent annotation aggregation is still loading.
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

const experimentAnnotationMetricsDataPointFragment = graphql`
  fragment useExperimentAnnotationMetricsData_dataPoint on ExperimentAnnotationMetricsDataPoint
  @inline {
    experiment {
      id
      name
      sequenceNumber
    }
    annotationSummaries {
      name
      meanScore
      labelFractions {
        label
        fraction
      }
    }
  }
`;

export const experimentAnnotationMetricsQuery = graphql`
  query useExperimentAnnotationMetricsDataQuery($id: ID!, $count: Int!) {
    dataset: node(id: $id) {
      ... on Dataset {
        experimentAnnotationMetrics(first: $count) {
          baselineExperiment {
            ...useExperimentAnnotationMetricsData_dataPoint
          }
          recentExperiments {
            ...useExperimentAnnotationMetricsData_dataPoint
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
        experimentAnnotationNames
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
    promptCost: data.costSummary.prompt.cost,
    completionCost: data.costSummary.completion.cost,
    totalCost: data.costSummary.total.cost,
    promptTokens: data.costSummary.prompt.tokens,
    completionTokens: data.costSummary.completion.tokens,
    totalTokens: data.costSummary.total.tokens,
  };
}

export type ExperimentAnnotationMetricsDatum = {
  id: string;
  name: string;
  sequenceNumber: number;
  isBaseline: boolean;
  annotationSummaries: readonly {
    name: string;
    meanScore: number | null;
    labelFractions: ReadonlyArray<{
      label: string;
      fraction: number;
    }>;
  }[];
};

function readExperimentAnnotationMetricsDatum({
  dataPoint,
  isBaseline,
}: {
  dataPoint: useExperimentAnnotationMetricsData_dataPoint$key;
  isBaseline: boolean;
}): ExperimentAnnotationMetricsDatum {
  const data = readInlineData<useExperimentAnnotationMetricsData_dataPoint$key>(
    experimentAnnotationMetricsDataPointFragment,
    dataPoint
  );
  return {
    id: data.experiment.id,
    name: data.experiment.name,
    sequenceNumber: data.experiment.sequenceNumber,
    isBaseline,
    annotationSummaries: data.annotationSummaries,
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

export function useExperimentAnnotationMetricsData(datasetId: string): {
  experiments: ExperimentAnnotationMetricsDatum[];
  baselineExperiment: ExperimentAnnotationMetricsDatum | null;
} {
  // Both annotation chart surfaces use this identical operation and variable
  // set so Relay can reuse its in-flight request or cached store result.
  const data = useLazyLoadQuery<useExperimentAnnotationMetricsDataQuery>(
    experimentAnnotationMetricsQuery,
    {
      id: datasetId,
      count: EXPERIMENT_METRICS_EXPERIMENT_COUNT,
    },
    { fetchPolicy: "store-or-network" }
  );
  const metrics = data.dataset.experimentAnnotationMetrics;
  invariant(metrics, "Dataset annotation metrics are required");
  const baselineExperiment =
    metrics.baselineExperiment == null
      ? null
      : readExperimentAnnotationMetricsDatum({
          dataPoint: metrics.baselineExperiment,
          isBaseline: true,
        });
  const baselineExperimentId = baselineExperiment?.id;
  const experiments = metrics.recentExperiments
    .map((dataPoint) =>
      readExperimentAnnotationMetricsDatum({ dataPoint, isBaseline: false })
    )
    .map((experiment) => ({
      ...experiment,
      isBaseline: experiment.id === baselineExperimentId,
    }))
    .sort((left, right) => left.sequenceNumber - right.sequenceNumber);

  return { experiments, baselineExperiment };
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
  return data.dataset.experimentAnnotationNames ?? [];
}
