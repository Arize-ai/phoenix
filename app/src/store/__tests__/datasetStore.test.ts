import { installTestStorage } from "@phoenix/__tests__/installTestStorage";
import {
  DEFAULT_EXPERIMENT_METRIC_CHART_KEYS,
  MAX_SELECTED_EXPERIMENT_METRIC_CHARTS,
} from "@phoenix/pages/dataset/constants";

import { createDatasetStore } from "../datasetStore";

installTestStorage();

const DATASET_ID = "RGF0YXNldDox";
const STORAGE_KEY = `arize-phoenix-dataset-${DATASET_ID}`;

const createStore = () =>
  createDatasetStore({
    datasetId: DATASET_ID,
    datasetName: "test dataset",
    latestVersion: null,
  });

const seedPersistedState = (state: unknown) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ state, version: 0 }));
};

describe("datasetStore", () => {
  beforeEach(() => {
    localStorage.removeItem(STORAGE_KEY);
  });

  describe("experimentsMetricChartKeys", () => {
    it("defaults to the default chart keys when nothing is persisted", () => {
      const store = createStore();
      expect(store.getState().experimentsMetricChartKeys).toEqual([
        "annotation_scores",
        "latency",
        "cost",
      ]);
      expect(DEFAULT_EXPERIMENT_METRIC_CHART_KEYS).toEqual([
        "annotation_scores",
        "latency",
        "cost",
      ]);
    });

    it("hydrates a persisted selection", () => {
      seedPersistedState({ experimentsMetricChartKeys: ["cost", "tokens"] });
      const store = createStore();
      expect(store.getState().experimentsMetricChartKeys).toEqual([
        "cost",
        "tokens",
      ]);
    });

    it("hydrates a persisted per-evaluation chart selection", () => {
      seedPersistedState({
        experimentsMetricChartKeys: ["evaluation:quality"],
      });
      const store = createStore();
      expect(store.getState().experimentsMetricChartKeys).toEqual([
        "evaluation:quality",
      ]);
    });

    it("drops persisted keys that are no longer in the chart catalog", () => {
      seedPersistedState({
        experimentsMetricChartKeys: ["latency", "bogus_chart"],
      });
      const store = createStore();
      expect(store.getState().experimentsMetricChartKeys).toEqual(["latency"]);
    });

    it("caps a persisted selection at the selection limit", () => {
      seedPersistedState({
        experimentsMetricChartKeys: [
          "annotation_scores",
          "latency",
          "cost",
          "tokens",
          "error_rate",
        ],
      });
      const store = createStore();
      expect(store.getState().experimentsMetricChartKeys).toHaveLength(
        MAX_SELECTED_EXPERIMENT_METRIC_CHARTS
      );
    });

    it("falls back to the defaults when the persisted value is not an array", () => {
      seedPersistedState({ experimentsMetricChartKeys: "latency" });
      const store = createStore();
      expect(store.getState().experimentsMetricChartKeys).toEqual(
        DEFAULT_EXPERIMENT_METRIC_CHART_KEYS
      );
    });

    it("persists only the chart selection", () => {
      const store = createStore();
      store.getState().setExperimentsMetricChartKeys(["error_rate"]);
      expect(store.getState().experimentsMetricChartKeys).toEqual([
        "error_rate",
      ]);
      const persisted = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
      expect(persisted.state).toEqual({
        experimentsMetricChartKeys: ["error_rate"],
      });
    });
  });
});
