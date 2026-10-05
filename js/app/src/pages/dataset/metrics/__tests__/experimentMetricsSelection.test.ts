import { describe, expect, it } from "vitest";

import { EXPERIMENT_METRICS_EXPERIMENT_COUNT } from "@phoenix/pages/dataset/constants";

import {
  getExperimentMetricsQueryVariables,
  orderBySelection,
} from "../experimentMetricsSelection";

describe("orderBySelection", () => {
  it("orders the base experiment first, then compare experiments in selection order", () => {
    const experiments = [{ id: "a" }, { id: "b" }, { id: "c" }];
    expect(
      orderBySelection({
        experiments,
        selection: { baseExperimentId: "b", compareExperimentIds: ["c", "a"] },
      }).map(({ id }) => id)
    ).toEqual(["b", "c", "a"]);
  });

  it("leaves out selected experiments that have not loaded and unselected experiments", () => {
    const experiments = [{ id: "a" }, { id: "b" }, { id: "unselected" }];
    expect(
      orderBySelection({
        experiments,
        selection: {
          baseExperimentId: "a",
          compareExperimentIds: ["not-loaded", "b"],
        },
      }).map(({ id }) => id)
    ).toEqual(["a", "b"]);
  });
});

describe("getExperimentMetricsQueryVariables", () => {
  it("loads the dataset's most recent experiments without a selection", () => {
    expect(
      getExperimentMetricsQueryVariables({ datasetId: "dataset" })
    ).toEqual({
      id: "dataset",
      count: EXPERIMENT_METRICS_EXPERIMENT_COUNT,
      filterIds: null,
      isSelection: false,
    });
  });

  it("loads exactly the selected experiments", () => {
    expect(
      getExperimentMetricsQueryVariables({
        datasetId: "dataset",
        selection: { baseExperimentId: "a", compareExperimentIds: ["b", "c"] },
      })
    ).toEqual({
      id: "dataset",
      count: 3,
      filterIds: ["a", "b", "c"],
      isSelection: true,
    });
  });
});
