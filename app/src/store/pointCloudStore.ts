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

const UnknownColor = "rgba(255, 255, 255, 0.5)";

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
  /**
   * Clear the selections in the point cloud
   * Done when the point cloud is re-loaded
   */
  resetSelections: () => void;
}

/**
 * The default point cloud properties in the case that there are two datasets.
 */
export const DEFAULT_DRIFT_POINT_CLOUD_PROPS: Partial<PointCloudProps> = {
  coloringStrategy: ColoringStrategy.dataset,
  pointGroupVisibility: {
    [DatasetGroup.primary]: true,
    [DatasetGroup.reference]: true,
  },
  pointGroupColors: {
    [DatasetGroup.primary]: ColorSchemes.Discrete2.WhiteLightBlue[0],
    [DatasetGroup.reference]: ColorSchemes.Discrete2.WhiteLightBlue[1],
  },
};

/**
 * The default point cloud properties in the case that there is only one dataset.
 */
export const DEFAULT_SINGLE_DATASET_POINT_CLOUD_PROPS: Partial<PointCloudProps> =
  {
    coloringStrategy: ColoringStrategy.correctness,
    pointGroupVisibility: {
      [CorrectnessGroup.correct]: true,
      [CorrectnessGroup.incorrect]: true,
    },
    pointGroupColors: {
      [CorrectnessGroup.correct]: ColorSchemes.Discrete2.LightBlueOrange[0],
      [CorrectnessGroup.incorrect]: ColorSchemes.Discrete2.LightBlueOrange[1],
    },
  };

export type PointCloudStore = ReturnType<typeof createPointCloudStore>;

export const createPointCloudStore = (initProps?: Partial<PointCloudProps>) => {
  // The default props irrespective of the number of datasets
  const defaultProps: PointCloudProps = {
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
    ...defaultProps,
    ...initProps,
    setSelectedPointIds: (ids) => set({ selectedPointIds: ids }),
    setSelectedClusterId: (id) => set({ selectedClusterId: id }),
    setColoringStrategy: (strategy) => {
      set({ coloringStrategy: strategy });
      switch (strategy) {
        case ColoringStrategy.correctness:
          set({
            pointGroupVisibility: {
              [CorrectnessGroup.correct]: true,
              [CorrectnessGroup.incorrect]: true,
              [CorrectnessGroup.unknown]: true,
            },
            pointGroupColors: {
              [CorrectnessGroup.correct]:
                ColorSchemes.Discrete2.LightBlueOrange[0],
              [CorrectnessGroup.incorrect]:
                ColorSchemes.Discrete2.LightBlueOrange[1],
              [CorrectnessGroup.unknown]: UnknownColor,
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
            pointGroupColors: {
              [DatasetGroup.primary]: ColorSchemes.Discrete2.WhiteLightBlue[0],
              [DatasetGroup.reference]:
                ColorSchemes.Discrete2.WhiteLightBlue[1],
            },
          });
          break;
        case ColoringStrategy.dimension:
          // For color by dimension, the visibility and the point group colors
          // come dynamically from the dimension "values"
          set({
            pointGroupVisibility: {
              unknown: true,
            },
            pointGroupColors: {
              unknown: UnknownColor,
            },
          });
          break;
        default:
          assertUnreachable(strategy);
      }
    },
    datasetVisibility: { primary: true, reference: true },
    setDatasetVisibility: (visibility) =>
      set({ datasetVisibility: visibility }),
    setPointGroupVisibility: (visibility) =>
      set({ pointGroupVisibility: visibility }),
    selectionDisplay: SelectionDisplay.gallery,
    setSelectionDisplay: (display) => set({ selectionDisplay: display }),
    resetSelections: () => {
      set({
        selectedPointIds: new Set(),
        selectedClusterId: null,
      });
    },
  });

  return create<PointCloudState>()(devtools(pointCloudStore));
};
