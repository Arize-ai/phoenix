import { commitLocalUpdate, fetchQuery, graphql } from "react-relay";
import { ConnectionHandler } from "relay-runtime";
import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

import type { ExperimentMetricChartKey } from "@phoenix/pages/dataset/constants";
import {
  DEFAULT_EXPERIMENT_METRIC_CHART_KEYS,
  isExperimentMetricChartKey,
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
  refreshLatestVersion: () => Promise<void>;
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
            try {
              const newVersion = await fetchLatestVersion({
                datasetId: dataset.datasetId,
              });
              if (newVersion) {
                prependVersionToHistory({
                  datasetId: dataset.datasetId,
                  versionId: newVersion.id,
                });
              }
              set(
                { latestVersion: newVersion, isRefreshingLatestVersion: false },
                false,
                { type: "refreshLatestVersionSuccess" }
              );
            } catch (error) {
              // Leave `latestVersion` alone — a failed refresh must not look like
              // a successful one — but never strand the in-flight flag.
              set({ isRefreshingLatestVersion: false }, false, {
                type: "refreshLatestVersionError",
              });
              throw error;
            }
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
            ...(persistedState as Partial<DatasetStoreState>),
          };
          // Persisted chart keys may reference charts that no longer exist in
          // the chart catalog; drop them so stale keys don't render as empty
          // panels
          const keys = merged.experimentsMetricChartKeys;
          merged.experimentsMetricChartKeys = Array.isArray(keys)
            ? keys.filter(isExperimentMetricChartKey)
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

/**
 * The `@connection` key of the versions table on the dataset's Versions tab.
 * Kept in sync with `DatasetHistoryTable_versions` in `DatasetHistoryTable`.
 */
const HISTORY_CONNECTION_KEY = "DatasetHistoryTable_versions";

/**
 * Adds a newly created version to the top of the Versions tab's list.
 *
 * The Versions tab is its own route, and its loader renders from the Relay
 * store when the list is already cached, so a version created from another
 * tab would otherwise stay missing until a full reload. The list is sorted
 * newest first, matching where the version is inserted. Nothing happens when
 * the list has never been loaded or already holds the version.
 */
function prependVersionToHistory({
  datasetId,
  versionId,
}: {
  datasetId: string;
  versionId: string;
}) {
  commitLocalUpdate(RelayEnvironment, (store) => {
    const dataset = store.get(datasetId);
    const version = store.get(versionId);
    if (!dataset || !version) {
      return;
    }
    const connection = ConnectionHandler.getConnection(
      dataset,
      HISTORY_CONNECTION_KEY
    );
    if (!connection) {
      return;
    }
    const isListed = (connection.getLinkedRecords("edges") ?? []).some(
      (edge) => edge?.getLinkedRecord("node")?.getDataID() === versionId
    );
    if (isListed) {
      return;
    }
    const edge = ConnectionHandler.createEdge(
      store,
      connection,
      version,
      "DatasetVersionEdge"
    );
    ConnectionHandler.insertEdgeBefore(connection, edge);
  });
}
