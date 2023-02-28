import { create, StateCreator } from "zustand";
import { devtools } from "zustand/middleware";

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
};

const pointCloudStore: StateCreator<PointCloudState> = (set) => ({
  selectedPointIds: new Set(),
  setSelectedPointIds: (ids) => set({ selectedPointIds: ids }),
  selectedClusterId: null,
  setSelectedClusterId: (id) => set({ selectedClusterId: id }),
});

export const usePointCloudStore = create<PointCloudState>()(
  devtools(pointCloudStore)
);
