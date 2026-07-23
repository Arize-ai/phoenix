import { fetchQuery, graphql } from "react-relay";
import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

import type { ExperimentMetricChartKey } from "@phoenix/pages/dataset/constants";
import {
  DEFAULT_EXPERIMENT_METRIC_CHART_KEYS,
  isExperimentMetricChartKey,
  MAX_SELECTED_EXPERIMENT_METRIC_CHARTS,
} from "@phoenix/pages/dataset/constants";
import RelayEnvironment from "@phoenix/RelayEnvironment";

import type { datasetStore_latestVersionQuery } from "./__generated__/datasetStore_latestVersionQuery.graphql";

interface DatasetVersion {
  id: string;
  description: string | null;
  createdAt: string;
}

export interface DatasetStoreProps {
  /**
   * The dataset currently loaded in the store
   */
  datasetId: string;
  /**
   * The dataset name
   */
  datasetName: string;
  /**
   * Tracks the latest version of the dataset
   * so that the UI stays consistent with any edits
   */
  latestVersion: DatasetVersion | null;
  /**
   * Track if the latest version is being refreshed
   */
  isRefreshingLatestVersion: boolean;
  /**
   * The metric charts to show above the experiments table
   */
  experimentsMetricChartKeys: ExperimentMetricChartKey[];
}

export type InitialDatasetStoreProps = Pick<
  DatasetStoreProps,
  "latestVersion" | "datasetId" | "datasetName"
>;

export interface DatasetStoreState extends DatasetStoreProps {
  /**
   * Refreshes the latest version of the dataset
   */
  refreshLatestVersion: () => void;
  /**
   * Set the metric charts to show above the experiments table
   */
  setExperimentsMetricChartKeys: (keys: ExperimentMetricChartKey[]) => void;
}

const makeDatasetStoreKey = (datasetId: string) =>
  `arize-phoenix-dataset-${datasetId}`;

export const createDatasetStore = (initialProps: InitialDatasetStoreProps) => {
  return create<DatasetStoreState>()(
    persist(
      devtools(
        (set, get) => ({
          ...initialProps,
          isRefreshingLatestVersion: false,
          refreshLatestVersion: async () => {
            const dataset = get();
            set({ isRefreshingLatestVersion: true }, false, {
              type: "refreshLatestVersionInit",
            });
            const newVersion = await fetchLatestVersion({
              datasetId: dataset.datasetId,
            });
            set(
              { latestVersion: newVersion, isRefreshingLatestVersion: false },
              false,
              { type: "refreshLatestVersionSuccess" }
            );
          },
          experimentsMetricChartKeys: DEFAULT_EXPERIMENT_METRIC_CHART_KEYS,
          setExperimentsMetricChartKeys: (keys: ExperimentMetricChartKey[]) => {
            set({ experimentsMetricChartKeys: keys }, false, {
              type: "setExperimentsMetricChartKeys",
            });
          },
        }),
        {
          name: "datasetStore",
        }
      ),
      {
        name: makeDatasetStoreKey(initialProps.datasetId),
        // Only the chart selection is a persistent preference; the rest of
        // the store (latest version, refresh state) must stay fresh per load
        partialize: (state) => ({
          experimentsMetricChartKeys: state.experimentsMetricChartKeys,
        }),
        merge: (persistedState, currentState) => {
          const merged = {
            ...currentState,
            // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- zustand persist stores JSON with a known shape; stale keys are sanitized below
            ...(persistedState as Partial<DatasetStoreState>),
          };
          // Persisted chart keys may reference charts that no longer exist in
          // the chart catalog; drop them so stale keys don't count against the
          // selection limit
          const keys = merged.experimentsMetricChartKeys;
          merged.experimentsMetricChartKeys = Array.isArray(keys)
            ? keys
                .filter(isExperimentMetricChartKey)
                .slice(0, MAX_SELECTED_EXPERIMENT_METRIC_CHARTS)
            : DEFAULT_EXPERIMENT_METRIC_CHART_KEYS;
          return merged;
        },
      }
    )
  );
};

export type DatasetStore = ReturnType<typeof createDatasetStore>;

async function fetchLatestVersion({
  datasetId,
}: {
  datasetId: string;
}): Promise<DatasetVersion | null> {
  const data = await fetchQuery<datasetStore_latestVersionQuery>(
    RelayEnvironment,
    graphql`
      query datasetStore_latestVersionQuery($datasetId: ID!) {
        dataset: node(id: $datasetId) {
          id
          ... on Dataset {
            latestVersions: versions(
              first: 1
              sort: { col: createdAt, dir: desc }
            ) {
              edges {
                version: node {
                  id
                  description
                  createdAt
                }
              }
            }
          }
        }
      }
    `,
    {
      datasetId,
    }
  ).toPromise();
  const versions = data?.dataset.latestVersions?.edges;
  const latestVersion =
    (versions && versions.length && versions[0].version) || null;
  return latestVersion;
}
