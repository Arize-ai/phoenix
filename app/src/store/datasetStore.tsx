import { create, StateCreator } from "zustand";
import { devtools } from "zustand/middleware";

interface DatasetVersion {
  id: string;
  description: string | null;
  createdAt: string;
}

export interface DatasetStoreProps {
  /**
   * Tracks the latest version of the dataset
   * so that the UI stays consistent with any edits
   */
  latestVersion: DatasetVersion;
  /**
   * Track if the latest version is being refreshed
   */
  isRefreshingLatestVersion: boolean;
}

export interface DatasetStoreState extends DatasetStoreProps {
  /**
   * Refreshes the latest version of the dataset
   */
  refreshLatestVersion: () => void;
}

export const createDatasetStore = (
  initialProps: Pick<DatasetStoreProps, "latestVersion">
) => {
  const datasetStore: StateCreator<DatasetStoreState> = (set) => ({
    ...initialProps,
    isRefreshingLatestVersion: false,
    refreshLatestVersion: () => {
      set({ isRefreshingLatestVersion: true });
      setTimeout(() => {
        set({ isRefreshingLatestVersion: false });
      }, 1000);
    },
  });
  return create<DatasetStoreState>()(devtools(datasetStore));
};

export type DatasetStore = ReturnType<typeof createDatasetStore>;
