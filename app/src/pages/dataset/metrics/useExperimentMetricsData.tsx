import type { ReactNode } from "react";
import { createContext, useContext, useEffect } from "react";
import type { PreloadedQuery } from "react-relay";
import {
  graphql,
  readInlineData,
  usePreloadedQuery,
  useQueryLoader,
} from "react-relay";
import invariant from "tiny-invariant";

import { Loading } from "@phoenix/components";
import { EXPERIMENT_METRICS_EXPERIMENT_COUNT } from "@phoenix/pages/dataset/constants";

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
  annotationMetricsQueryReference: PreloadedQuery<useExperimentAnnotationMetricsDataQuery>;
};

const ExperimentMetricsQueryContext =
  createContext<ExperimentMetricsQueryContextValue | null>(null);

/** Starts core and annotation requests together while retaining each Relay query. */
export function ExperimentMetricsDataProvider({
  datasetId,
  children,
}: {
  datasetId: string;
  children: ReactNode;
}) {
  const [metricsQueryReference, loadMetricsQuery] =
    useQueryLoader<useExperimentMetricsDataQuery>(experimentMetricsQuery);
  const [annotationMetricsQueryReference, loadAnnotationMetricsQuery] =
    useQueryLoader<useExperimentAnnotationMetricsDataQuery>(
      experimentAnnotationMetricsQuery
    );

  useEffect(() => {
    const variables = {
      id: datasetId,
      count: EXPERIMENT_METRICS_EXPERIMENT_COUNT,
    };
    // Both requests depend only on the dataset, so start them together rather
    // than waiting for the core experiment window before loading annotations.
    loadMetricsQuery(variables, { fetchPolicy: "store-or-network" });
    loadAnnotationMetricsQuery(variables, {
      // Aggregates are not normalized Relay records and can change after an
      // evaluation or baseline mutation, so refresh them whenever this page loads.
      fetchPolicy: "store-and-network",
    });
  }, [datasetId, loadAnnotationMetricsQuery, loadMetricsQuery]);

  if (
    metricsQueryReference == null ||
    annotationMetricsQueryReference == null
  ) {
    return <Loading />;
  }

  return (
    <ExperimentMetricsQueryContext.Provider
      value={{
        datasetId,
        metricsQueryReference,
        annotationMetricsQueryReference,
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
  const { annotationMetricsQueryReference } =
    useExperimentMetricsQueryContext(datasetId);
  const data = usePreloadedQuery<useExperimentAnnotationMetricsDataQuery>(
    experimentAnnotationMetricsQuery,
    annotationMetricsQueryReference
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
