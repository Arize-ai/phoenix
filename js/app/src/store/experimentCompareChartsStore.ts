import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

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
        }),
        { name: "experimentCompareChartsStore" }
      ),
      {
        name: "arize-phoenix-experiment-compare-charts",
        partialize: (state) => ({
          metricChartKeysByDatasetId: state.metricChartKeysByDatasetId,
          areMetricChartsVisibleByDatasetId:
            state.areMetricChartsVisibleByDatasetId,
        }),
        merge: (persistedState, currentState) => {
          const persisted = (persistedState ?? {}) as Partial<
            Pick<
              ExperimentCompareChartsState,
              "metricChartKeysByDatasetId" | "areMetricChartsVisibleByDatasetId"
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
          const areMetricChartsVisibleByDatasetId = Object.fromEntries(
            Object.entries(
              persisted.areMetricChartsVisibleByDatasetId ?? {}
            ).filter(([, isVisible]) => typeof isVisible === "boolean")
          );
          return {
            ...currentState,
            metricChartKeysByDatasetId,
            areMetricChartsVisibleByDatasetId,
          };
        },
      }
    )
  );
