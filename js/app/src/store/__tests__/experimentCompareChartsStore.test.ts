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
      areMetricChartsHiddenByDatasetId: {},
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
        areMetricChartsHiddenByDatasetId: {},
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
        .areMetricChartsHiddenByDatasetId
    ).toEqual({ "dataset-1": true });
  });

  it("drops persisted visibility entries that are not hidden flags", async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        state: {
          metricChartKeysByDatasetId: {},
          areMetricChartsHiddenByDatasetId: {
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
        .areMetricChartsHiddenByDatasetId
    ).toEqual({ "dataset-1": true });
  });
});
