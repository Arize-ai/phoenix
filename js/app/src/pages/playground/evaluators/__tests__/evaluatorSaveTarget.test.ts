import { describe, expect, it } from "vitest";

import {
  getEvaluatorSaveTarget,
  isProjectEvaluatorUpdate,
} from "../evaluatorSaveTarget";

const onThisDataset = { id: "binding-1", dataset: { id: "dataset-1" } };
const onOtherDataset = { id: "binding-2", dataset: { id: "dataset-2" } };
const dataset1 = { kind: "dataset", datasetId: "dataset-1" } as const;
const project1 = { kind: "project", projectId: "project-1" } as const;

describe("getEvaluatorSaveTarget", () => {
  it("creates for a new draft or without a source", () => {
    expect(
      getEvaluatorSaveTarget({
        source: null,
        selectedBinding: null,
        playgroundSource: dataset1,
      })
    ).toEqual({ action: "create" });
    expect(
      getEvaluatorSaveTarget({
        source: {
          id: "code",
          kind: "CODE",
          datasetEvaluators: [onThisDataset],
        },
        selectedBinding: null,
        playgroundSource: null,
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
        selectedBinding: null,
        playgroundSource: dataset1,
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
        selectedBinding: {
          kind: "dataset",
          id: "twin",
          datasetId: "dataset-1",
        },
        playgroundSource: dataset1,
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
        selectedBinding: {
          kind: "dataset",
          id: "binding-2",
          datasetId: "dataset-2",
        },
        playgroundSource: dataset1,
      })
    ).toEqual({ action: "attach", evaluatorId: "code" });
    expect(
      getEvaluatorSaveTarget({
        source: { id: "llm", kind: "LLM", datasetEvaluators: [onOtherDataset] },
        selectedBinding: null,
        playgroundSource: dataset1,
      })
    ).toEqual({ action: "create" });
  });

  it("updates the project evaluator the slot was opened from, on that project", () => {
    const target = getEvaluatorSaveTarget({
      source: { id: "llm", kind: "LLM", datasetEvaluators: [] },
      selectedBinding: { kind: "project", id: "pe-1", projectId: "project-1" },
      playgroundSource: project1,
    });
    expect(target).toEqual({
      action: "update",
      evaluatorId: "llm",
      projectEvaluatorId: "pe-1",
    });
    expect(isProjectEvaluatorUpdate(target)).toBe(true);
  });

  it("on a project, a bare shared evaluator attaches (code) or is copied (LLM)", () => {
    expect(
      getEvaluatorSaveTarget({
        source: {
          id: "code",
          kind: "CODE",
          datasetEvaluators: [onThisDataset],
        },
        selectedBinding: {
          kind: "project",
          id: "pe-other",
          projectId: "project-2",
        },
        playgroundSource: project1,
      })
    ).toEqual({ action: "attach", evaluatorId: "code" });
    expect(
      getEvaluatorSaveTarget({
        source: { id: "llm", kind: "LLM", datasetEvaluators: [onThisDataset] },
        selectedBinding: null,
        playgroundSource: project1,
      })
    ).toEqual({ action: "create" });
  });

  it("a dataset binding never counts as an update on a project", () => {
    expect(
      isProjectEvaluatorUpdate({
        action: "update",
        evaluatorId: "llm",
        datasetEvaluatorId: "binding-1",
      })
    ).toBe(false);
  });
});
