import { describe, expect, it } from "vitest";

import { getEvaluatorSaveTarget } from "../evaluatorSaveTarget";

const onThisDataset = { id: "binding-1", dataset: { id: "dataset-1" } };
const onOtherDataset = { id: "binding-2", dataset: { id: "dataset-2" } };

describe("getEvaluatorSaveTarget", () => {
  it("creates for a new draft or without a dataset", () => {
    expect(
      getEvaluatorSaveTarget({
        source: null,
        selectedDatasetEvaluator: null,
        datasetId: "dataset-1",
      })
    ).toEqual({ action: "create" });
    expect(
      getEvaluatorSaveTarget({
        source: {
          id: "code",
          kind: "CODE",
          datasetEvaluators: [onThisDataset],
        },
        selectedDatasetEvaluator: null,
        datasetId: null,
      })
    ).toEqual({ action: "create" });
  });

  it("updates an evaluator that is already on the dataset", () => {
    expect(
      getEvaluatorSaveTarget({
        source: {
          id: "llm",
          kind: "LLM",
          datasetEvaluators: [onOtherDataset, onThisDataset],
        },
        selectedDatasetEvaluator: null,
        datasetId: "dataset-1",
      })
    ).toEqual({
      action: "update",
      evaluatorId: "llm",
      datasetEvaluatorId: "binding-1",
    });
  });

  it("prefers the binding the slot was opened from", () => {
    expect(
      getEvaluatorSaveTarget({
        source: {
          id: "code",
          kind: "CODE",
          datasetEvaluators: [onThisDataset, { ...onThisDataset, id: "twin" }],
        },
        selectedDatasetEvaluator: { id: "twin", datasetId: "dataset-1" },
        datasetId: "dataset-1",
      })
    ).toMatchObject({ action: "update", datasetEvaluatorId: "twin" });
  });

  it("attaches a shared code evaluator and copies an LLM evaluator", () => {
    expect(
      getEvaluatorSaveTarget({
        source: {
          id: "code",
          kind: "CODE",
          datasetEvaluators: [onOtherDataset],
        },
        selectedDatasetEvaluator: { id: "binding-2", datasetId: "dataset-2" },
        datasetId: "dataset-1",
      })
    ).toEqual({ action: "attach", evaluatorId: "code" });
    expect(
      getEvaluatorSaveTarget({
        source: { id: "llm", kind: "LLM", datasetEvaluators: [onOtherDataset] },
        selectedDatasetEvaluator: null,
        datasetId: "dataset-1",
      })
    ).toEqual({ action: "create" });
  });
});
