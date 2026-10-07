import { installTestStorage } from "@phoenix/__tests__/installTestStorage";

import type { useExperimentCompareChartsStore as UseExperimentCompareChartsStore } from "../experimentCompareChartsStore";

installTestStorage();

let useExperimentCompareChartsStore: typeof UseExperimentCompareChartsStore;

// The store binds to localStorage when created, so import it once the test
// storage is installed
beforeAll(async () => {
  ({ useExperimentCompareChartsStore } =
    await import("../experimentCompareChartsStore"));
});

const STORAGE_KEY = "arize-phoenix-experiment-compare-charts";

describe("experimentCompareChartsStore", () => {
  beforeEach(() => {
    localStorage.removeItem(STORAGE_KEY);
    useExperimentCompareChartsStore.setState({
      metricChartKeysByDatasetId: {},
      areMetricChartsVisibleByDatasetId: {},
      areDeltasVisibleByDatasetId: {},
    });
  });

  it("persists each dataset's chart selection separately", () => {
    const { setMetricChartKeys } = useExperimentCompareChartsStore.getState();
    setMetricChartKeys({ datasetId: "dataset-1", keys: ["latency"] });
    setMetricChartKeys({
      datasetId: "dataset-2",
      keys: ["annotation:quality", "error_rate"],
    });
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}").state).toEqual(
      {
        metricChartKeysByDatasetId: {
          "dataset-1": ["latency"],
          "dataset-2": ["annotation:quality", "error_rate"],
        },
        areMetricChartsVisibleByDatasetId: {},
        areDeltasVisibleByDatasetId: {},
      }
    );
  });

  it("drops persisted keys that are no longer in the chart catalog", async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        state: {
          metricChartKeysByDatasetId: {
            "dataset-1": ["latency", "bogus_chart", "annotation:quality"],
            "dataset-2": "not-a-list",
          },
        },
        version: 0,
      })
    );
    await useExperimentCompareChartsStore.persist.rehydrate();
    expect(
      useExperimentCompareChartsStore.getState().metricChartKeysByDatasetId
    ).toEqual({ "dataset-1": ["latency", "annotation:quality"] });
  });

  it("persists each dataset's chart visibility separately", () => {
    const { setAreMetricChartsVisible } =
      useExperimentCompareChartsStore.getState();
    setAreMetricChartsVisible({ datasetId: "dataset-1", isVisible: false });
    setAreMetricChartsVisible({ datasetId: "dataset-2", isVisible: false });
    setAreMetricChartsVisible({ datasetId: "dataset-2", isVisible: true });
    expect(
      JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}").state
        .areMetricChartsVisibleByDatasetId
    ).toEqual({ "dataset-1": false, "dataset-2": true });
  });

  it("drops persisted visibility entries that are not booleans", async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        state: {
          metricChartKeysByDatasetId: {},
          areMetricChartsVisibleByDatasetId: {
            "dataset-1": true,
            "dataset-2": "yes",
            "dataset-3": false,
          },
        },
        version: 0,
      })
    );
    await useExperimentCompareChartsStore.persist.rehydrate();
    expect(
      useExperimentCompareChartsStore.getState()
        .areMetricChartsVisibleByDatasetId
    ).toEqual({ "dataset-1": true, "dataset-3": false });
  });

  it("persists each dataset's delta visibility separately", () => {
    const { setAreDeltasVisible } = useExperimentCompareChartsStore.getState();
    setAreDeltasVisible({ datasetId: "dataset-1", isVisible: false });
    setAreDeltasVisible({ datasetId: "dataset-2", isVisible: true });
    expect(
      JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}").state
        .areDeltasVisibleByDatasetId
    ).toEqual({ "dataset-1": false, "dataset-2": true });
  });

  it("drops persisted delta visibility entries that are not booleans", async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        state: {
          metricChartKeysByDatasetId: {},
          areDeltasVisibleByDatasetId: { "dataset-1": false, "dataset-2": 1 },
        },
        version: 0,
      })
    );
    await useExperimentCompareChartsStore.persist.rehydrate();
    expect(
      useExperimentCompareChartsStore.getState().areDeltasVisibleByDatasetId
    ).toEqual({ "dataset-1": false });
  });
});
