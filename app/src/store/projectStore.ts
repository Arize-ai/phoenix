import type { StoreApi } from "zustand";
import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

import type {
  MetricChartTableView,
  ProjectMetricChartKey,
  ProjectTab,
} from "@phoenix/pages/project/constants";
import {
  DEFAULT_METRIC_CHART_KEYS,
  isProjectMetricChartKey,
  MAX_SELECTED_METRIC_CHARTS,
  METRIC_CHART_TABLE_VIEWS,
} from "@phoenix/pages/project/constants";

export interface ProjectState {
  defaultTab: ProjectTab;
  setDefaultTab: (tab: ProjectTab) => void;
  /**
   * Whether to show the aside panel on the spans and traces tables.
   * @default true
   */
  showTableAside: boolean;
  /**
   * Set whether to show the aside panel on the spans and traces tables.
   */
  setShowTableAside: (showTableAside: boolean) => void;
  /**
   * The metric charts to show above each project table view.
   */
  metricChartKeys: Record<MetricChartTableView, ProjectMetricChartKey[]>;
  /**
   * Set the metric charts to show above a project table view.
   */
  setMetricChartKeys: (
    view: MetricChartTableView,
    keys: ProjectMetricChartKey[]
  ) => void;
}

export interface ProjectStore {
  state: StoreApi<ProjectState>;
}

const makeProjectStoreKey = (projectId: string) =>
  `arize-phoenix-project-${projectId}`;

export type CreateProjectStoreProps = {
  projectId: string;
};

export function createProjectStore({
  projectId,
}: CreateProjectStoreProps): ProjectStore {
  const state = create<ProjectState>()(
    persist(
      devtools((set) => ({
        defaultTab: "spans",
        setDefaultTab: (tab: ProjectTab) => {
          set({ defaultTab: tab }, false, { type: "setDefaultTab" });
        },
        showTableAside: true,
        setShowTableAside: (showTableAside: boolean) => {
          set({ showTableAside }, false, {
            type: "setShowTableAside",
          });
        },
        metricChartKeys: DEFAULT_METRIC_CHART_KEYS,
        setMetricChartKeys: (
          view: MetricChartTableView,
          keys: ProjectMetricChartKey[]
        ) => {
          set(
            (state) => ({
              metricChartKeys: { ...state.metricChartKeys, [view]: keys },
            }),
            false,
            { type: "setMetricChartKeys" }
          );
        },
      })),
      {
        name: makeProjectStoreKey(projectId),
        merge: (persistedState, currentState) => {
          const merged = {
            ...currentState,
            ...(persistedState as Partial<ProjectState>),
          };
          // Persisted chart keys may reference charts that no longer exist in
          // the chart catalog; drop them so stale keys don't count against the
          // selection limit
          const metricChartKeys = { ...DEFAULT_METRIC_CHART_KEYS };
          for (const view of METRIC_CHART_TABLE_VIEWS) {
            const keys = merged.metricChartKeys?.[view];
            if (Array.isArray(keys)) {
              metricChartKeys[view] = keys
                .filter(isProjectMetricChartKey)
                .slice(0, MAX_SELECTED_METRIC_CHARTS);
            }
          }
          merged.metricChartKeys = metricChartKeys;
          return merged;
        },
      }
    )
  );

  return { state };
}
