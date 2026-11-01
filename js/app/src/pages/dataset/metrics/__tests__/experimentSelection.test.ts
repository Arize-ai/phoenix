import { describe, expect, it } from "vitest";

import { EXPERIMENT_METRICS_EXPERIMENT_COUNT } from "@phoenix/pages/dataset/constants";

import {
  getExperimentMetricsQueryVariables,
  orderByComparedSelection,
} from "../experimentSelection";
import { RECENT_EXPERIMENT_SELECTION } from "../types";

describe("orderByComparedSelection", () => {
  it("orders the base experiment first, then compare experiments in selection order", () => {
    const experiments = [{ id: "a" }, { id: "b" }, { id: "c" }];
    expect(
      orderByComparedSelection({
        experiments,
        experimentSelection: {
          type: "compared",
          baseExperimentId: "b",
          compareExperimentIds: ["c", "a"],
        },
      }).map(({ id }) => id)
    ).toEqual(["b", "c", "a"]);
  });

  it("leaves out compared experiments that have not loaded and experiments outside the comparison", () => {
    const experiments = [{ id: "a" }, { id: "b" }, { id: "unselected" }];
    expect(
      orderByComparedSelection({
        experiments,
        experimentSelection: {
          type: "compared",
          baseExperimentId: "a",
          compareExperimentIds: ["not-loaded", "b"],
        },
      }).map(({ id }) => id)
    ).toEqual(["a", "b"]);
  });
});

describe("getExperimentMetricsQueryVariables", () => {
  it("loads the dataset's most recent experiments for the recent experimentSelection", () => {
    expect(
      getExperimentMetricsQueryVariables({
        datasetId: "dataset",
        experimentSelection: RECENT_EXPERIMENT_SELECTION,
      })
    ).toEqual({
      id: "dataset",
      count: EXPERIMENT_METRICS_EXPERIMENT_COUNT,
      filterIds: null,
      isComparedSelection: false,
    });
  });

  it("loads exactly the compared experiments for a comparison experimentSelection", () => {
    expect(
      getExperimentMetricsQueryVariables({
        datasetId: "dataset",
        experimentSelection: {
          type: "compared",
          baseExperimentId: "a",
          compareExperimentIds: ["b", "c"],
        },
      })
    ).toEqual({
      id: "dataset",
      count: 3,
      filterIds: ["a", "b", "c"],
      isComparedSelection: true,
    });
  });
});
