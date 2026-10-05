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
        }),
        { name: "experimentCompareChartsStore" }
      ),
      {
        name: "arize-phoenix-experiment-compare-charts",
        partialize: (state) => ({
          metricChartKeysByDatasetId: state.metricChartKeysByDatasetId,
        }),
        merge: (persistedState, currentState) => {
          const persisted = (persistedState ?? {}) as Partial<
            Pick<ExperimentCompareChartsState, "metricChartKeysByDatasetId">
          >;
          const metricChartKeysByDatasetId = Object.fromEntries(
            Object.entries(persisted.metricChartKeysByDatasetId ?? {}).flatMap(
              ([datasetId, keys]) =>
                Array.isArray(keys)
                  ? [[datasetId, sanitizeExperimentMetricChartKeys(keys, [])]]
                  : []
            )
          );
          return { ...currentState, metricChartKeysByDatasetId };
        },
      }
    )
  );
