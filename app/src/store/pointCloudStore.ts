import { create, StateCreator } from "zustand";
import { devtools } from "zustand/middleware";

import { ColorSchemes } from "@arizeai/point-cloud";

import {
  ColoringStrategy,
  CorrectnessGroup,
  DatasetGroup,
  SelectionDisplay,
} from "@phoenix/types";
import { assertUnreachable } from "@phoenix/typeUtils";

/**
 * The visibility of the two datasets in the point cloud.
 */
type DatasetVisibility = {
  primary: boolean;
  reference: boolean;
};

/**
 * The properties of the point cloud store.
 */
export interface PointCloudProps {
  /**
   * The IDs of the points that are currently selected.
   */
  selectedPointIds: Set<string>;
  /**
   * The IDs of the clusters that are currently selected.
   */
  selectedClusterId: string | null;
  /**
   * The coloring strategy to use for the point cloud.
   */
  coloringStrategy: ColoringStrategy;
  /**
   * The visibility of the two datasets in the point cloud.
   * @default { primary: true, reference: true }
   */
  datasetVisibility: DatasetVisibility;
  /**
   * The visibility of the point groups in the point cloud.
   */
  pointGroupVisibility: Record<string, boolean>;
  /**
   * The colors of each point group in the point cloud.
   */
  pointGroupColors: Record<string, string>;
  /**
   * The way in which the selected points are displayed in the selection panel
   */
  selectionDisplay: SelectionDisplay;
}

export interface PointCloudState extends PointCloudProps {
  /**
   * Sets the selected point IDs to the given value.
   */
  setSelectedPointIds: (ids: Set<string>) => void;

  /**
   * Sets the selected cluster id to the given value.
   */
  setSelectedClusterId: (ids: string | null) => void;
  /**
   * Sets the coloring strategy to the given value.
   */
  setColoringStrategy: (strategy: ColoringStrategy) => void;
  /**
   * Sets the dataset visibility to the given value.
   * @param {DatasetVisibility} visibility
   */
  setDatasetVisibility: (visibility: DatasetVisibility) => void;
  /**
   * Sets the point group visibility for the entire point cloud
   * @param {Record<string, PointGroupVisibility>} visibility
   */
  setPointGroupVisibility: (visibility: Record<string, boolean>) => void;
  /**
   * Set the selection display of the selection panel
   */
  setSelectionDisplay: (display: SelectionDisplay) => void;
}

/**
 * The default point cloud properties in the case that there are two datasets.
 */
const DEFAULT_DRIFT_POINT_CLOUD_PROPS: PointCloudProps = {
  selectedPointIds: new Set(),
  selectedClusterId: null,
  coloringStrategy: ColoringStrategy.dataset,
  datasetVisibility: { primary: true, reference: true },
  pointGroupVisibility: {
    [DatasetGroup.primary]: true,
    [DatasetGroup.reference]: true,
  },
  pointGroupColors: {
    [DatasetGroup.primary]: ColorSchemes.Discrete2.WhiteLightBlue[0],
    [DatasetGroup.reference]: ColorSchemes.Discrete2.WhiteLightBlue[1],
  },
  selectionDisplay: SelectionDisplay.gallery,
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
  selectionDisplay: SelectionDisplay.gallery,
  setSelectionDisplay: (display) => set({ selectionDisplay: display }),
});

export const usePointCloudStore = create<PointCloudState>()(
  devtools(pointCloudStore)
);
