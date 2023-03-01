import { create, StateCreator } from "zustand";
import { devtools } from "zustand/middleware";

import { ColoringStrategy } from "@phoenix/types";

/**
 * The visibility of the two datasets in the point cloud.
 */
type DatasetVisibility = {
  primary: boolean;
  reference: boolean;
};

export type PointCloudState = {
  /**
   * The IDs of the points that are currently selected.
   */
  selectedPointIds: Set<string>;
  /**
   * Sets the selected point IDs to the given value.
   */
  setSelectedPointIds: (ids: Set<string>) => void;
  /**
   * The IDs of the clusters that are currently selected.
   */
  selectedClusterId: string | null;
  /**
   * Sets the selected cluster id to the given value.
   */
  setSelectedClusterId: (ids: string | null) => void;
  /**
   * The coloring strategy to use for the point cloud.
   */
  coloringStrategy: ColoringStrategy;
  /**
   * Sets the coloring strategy to the given value.
   */
  setColoringStrategy: (strategy: ColoringStrategy) => void;
  /**
   * The visibility of the two datasets in the point cloud.
   * @default { primary: true, reference: true }
   */
  datasetVisibility: DatasetVisibility;
  /**
   * Sets the dataset visibility to the given value.
   * @param {DatasetVisibility} visibility
   * @returns {void}
   */
  setDatasetVisibility: (visibility: DatasetVisibility) => void;
};

const pointCloudStore: StateCreator<PointCloudState> = (set) => ({
  selectedPointIds: new Set(),
  setSelectedPointIds: (ids) => set({ selectedPointIds: ids }),
  selectedClusterId: null,
  setSelectedClusterId: (id) => set({ selectedClusterId: id }),
  coloringStrategy: ColoringStrategy.dataset,
  setColoringStrategy: (strategy) => set({ coloringStrategy: strategy }),
  datasetVisibility: { primary: true, reference: true },
  setDatasetVisibility: (visibility) => set({ datasetVisibility: visibility }),
});

export const usePointCloudStore = create<PointCloudState>()(
  devtools(pointCloudStore)
);
