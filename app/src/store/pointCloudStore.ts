import { create, StateCreator } from "zustand";
import { devtools } from "zustand/middleware";

import { ColorSchemes } from "@arizeai/point-cloud";

import {
  ColoringStrategy,
  CorrectnessGroup,
  DatasetGroup,
} from "@phoenix/types";
import { assertUnreachable } from "@phoenix/typeUtils";

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
   */
  setDatasetVisibility: (visibility: DatasetVisibility) => void;
  /**
   * The visibility of the point groups in the point cloud.
   */
  pointGroupVisibility: Record<string, boolean>;
  /**
   * Sets the point group visibility for the entire point cloud
   * @param {Record<string, PointGroupVisibility>} visibility
   */
  setPointGroupVisibility: (visibility: Record<string, boolean>) => void;
  /**
   * The colors of each point group in the point cloud.
   */
  pointGroupColors: Record<string, string>;
};

const pointCloudStore: StateCreator<PointCloudState> = (set) => ({
  selectedPointIds: new Set(),
  setSelectedPointIds: (ids) => set({ selectedPointIds: ids }),
  selectedClusterId: null,
  setSelectedClusterId: (id) => set({ selectedClusterId: id }),
  coloringStrategy: ColoringStrategy.dataset,
  setColoringStrategy: (strategy) => {
    set({ coloringStrategy: strategy });
    switch (strategy) {
      case ColoringStrategy.correctness:
        set({
          pointGroupVisibility: {
            [CorrectnessGroup.correct]: true,
            [CorrectnessGroup.incorrect]: true,
          },
          pointGroupColors: {
            [CorrectnessGroup.correct]:
              ColorSchemes.Discrete2.LightBlueOrange[0],
            [CorrectnessGroup.incorrect]:
              ColorSchemes.Discrete2.LightBlueOrange[1],
          },
        });
        break;
      case ColoringStrategy.dataset:
        // Clear out the point groups as there are no groups
        set({
          pointGroupVisibility: {
            [DatasetGroup.primary]: true,
            [DatasetGroup.reference]: true,
          },
        });
        break;
      default:
        assertUnreachable(strategy);
    }
  },
  datasetVisibility: { primary: true, reference: true },
  setDatasetVisibility: (visibility) => set({ datasetVisibility: visibility }),
  pointGroupVisibility: {
    [DatasetGroup.primary]: true,
    [DatasetGroup.reference]: true,
  },
  setPointGroupVisibility: (visibility) =>
    set({ pointGroupVisibility: visibility }),
  pointGroupColors: {
    [DatasetGroup.primary]: ColorSchemes.Discrete2.WhiteLightBlue[0],
    [DatasetGroup.reference]: ColorSchemes.Discrete2.WhiteLightBlue[1],
  },
});

export const usePointCloudStore = create<PointCloudState>()(
  devtools(pointCloudStore)
);
