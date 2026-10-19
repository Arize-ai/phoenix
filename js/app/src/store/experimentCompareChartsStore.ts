import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

import { EXPERIMENT_COMPARE_CHARTS_STORAGE_KEY } from "@phoenix/constants/storageConstants";
import type { ExperimentMetricChartKey } from "@phoenix/pages/dataset/constants";
import { sanitizeExperimentMetricChartKeys } from "@phoenix/pages/dataset/constants";

export interface ExperimentCompareChartsState {
  /**
   * The metric charts shown above the experiment compare grid, per dataset.
   * A dataset without an entry shows the default charts.
   */
  metricChartKeysByDatasetId: Record<string, ExperimentMetricChartKey[]>;
  /**
   * Set the metric charts shown above a dataset's experiment compare grid
   */
  setMetricChartKeys: (params: {
    datasetId: string;
    keys: ExperimentMetricChartKey[];
  }) => void;
  /**
   * Whether the metric charts above the experiment compare grid are shown,
   * per dataset. A dataset without an entry shows its charts.
   */
  areMetricChartsVisibleByDatasetId: Record<string, boolean>;
  /**
   * Show or hide the metric charts above a dataset's experiment compare grid
   */
  setAreMetricChartsVisible: (params: {
    datasetId: string;
    isVisible: boolean;
  }) => void;
  /**
   * Whether the experiment compare grid shows each compare experiment's
   * deltas against the base, per dataset. A dataset without an entry shows
   * them.
   */
  areDeltasVisibleByDatasetId: Record<string, boolean>;
  /**
   * Show or hide the deltas against the base on a dataset's experiment
   * compare grid
   */
  setAreDeltasVisible: (params: {
    datasetId: string;
    isVisible: boolean;
  }) => void;
}

/**
 * Keeps only the per-dataset entries that are booleans.
 */
function sanitizeVisibilityByDatasetId(
  visibilityByDatasetId: Record<string, unknown> | undefined
): Record<string, boolean> {
  return Object.fromEntries(
    Object.entries(visibilityByDatasetId ?? {}).filter(
      (entry): entry is [string, boolean] => typeof entry[1] === "boolean"
    )
  );
}

/**
 * The experiment compare page's chart selection, persisted to local storage
 * and keyed by dataset so each dataset remembers its own charts.
 */
export const useExperimentCompareChartsStore =
  create<ExperimentCompareChartsState>()(
    persist(
      devtools(
        (set) => ({
          metricChartKeysByDatasetId: {},
          setMetricChartKeys: ({ datasetId, keys }) => {
            set(
              (state) => ({
                metricChartKeysByDatasetId: {
                  ...state.metricChartKeysByDatasetId,
                  [datasetId]: keys,
                },
              }),
              false,
              { type: "setMetricChartKeys" }
            );
          },
          areMetricChartsVisibleByDatasetId: {},
          setAreMetricChartsVisible: ({ datasetId, isVisible }) => {
            set(
              (state) => ({
                areMetricChartsVisibleByDatasetId: {
                  ...state.areMetricChartsVisibleByDatasetId,
                  [datasetId]: isVisible,
                },
              }),
              false,
              { type: "setAreMetricChartsVisible" }
            );
          },
          areDeltasVisibleByDatasetId: {},
          setAreDeltasVisible: ({ datasetId, isVisible }) => {
            set(
              (state) => ({
                areDeltasVisibleByDatasetId: {
                  ...state.areDeltasVisibleByDatasetId,
                  [datasetId]: isVisible,
                },
              }),
              false,
              { type: "setAreDeltasVisible" }
            );
          },
        }),
        { name: "experimentCompareChartsStore" }
      ),
      {
        name: EXPERIMENT_COMPARE_CHARTS_STORAGE_KEY,
        partialize: (state) => ({
          metricChartKeysByDatasetId: state.metricChartKeysByDatasetId,
          areMetricChartsVisibleByDatasetId:
            state.areMetricChartsVisibleByDatasetId,
          areDeltasVisibleByDatasetId: state.areDeltasVisibleByDatasetId,
        }),
        merge: (persistedState, currentState) => {
          const persisted = (persistedState ?? {}) as Partial<
            Pick<
              ExperimentCompareChartsState,
              | "metricChartKeysByDatasetId"
              | "areMetricChartsVisibleByDatasetId"
              | "areDeltasVisibleByDatasetId"
            >
          >;
          const metricChartKeysByDatasetId = Object.fromEntries(
            Object.entries(persisted.metricChartKeysByDatasetId ?? {}).flatMap(
              ([datasetId, keys]) =>
                Array.isArray(keys)
                  ? [[datasetId, sanitizeExperimentMetricChartKeys(keys, [])]]
                  : []
            )
          );
          const areMetricChartsVisibleByDatasetId =
            sanitizeVisibilityByDatasetId(
              persisted.areMetricChartsVisibleByDatasetId
            );
          const areDeltasVisibleByDatasetId = sanitizeVisibilityByDatasetId(
            persisted.areDeltasVisibleByDatasetId
          );
          return {
            ...currentState,
            metricChartKeysByDatasetId,
            areMetricChartsVisibleByDatasetId,
            areDeltasVisibleByDatasetId,
          };
        },
      }
    )
  );
