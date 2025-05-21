import { fetchQuery, graphql } from "react-relay";
import { create, StateCreator } from "zustand";
import { devtools } from "zustand/middleware";

import RelayEnvironment from "@phoenix/RelayEnvironment";

import { datasetStore_latestVersionQuery } from "./__generated__/datasetStore_latestVersionQuery.graphql";

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
}

export const createDatasetStore = (initialProps: InitialDatasetStoreProps) => {
  const datasetStore: StateCreator<DatasetStoreState> = (set, get) => ({
    ...initialProps,
    isRefreshingLatestVersion: false,
    refreshLatestVersion: async () => {
      const dataset = get();
      set({ isRefreshingLatestVersion: true });
      const newVersion = await fetchLatestVersion({
        datasetId: dataset.datasetId,
      });
      set({ latestVersion: newVersion, isRefreshingLatestVersion: false });
    },
  });
  return create<DatasetStoreState>()(devtools(datasetStore));
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
