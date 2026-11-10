import { describe, expect, it } from "vitest";

import {
  getDeleteAssociatedLabel,
  getDeleteEvaluatorsCopy,
} from "@phoenix/components/evaluators/deleteEvaluatorsCopy";

describe("getDeleteEvaluatorsCopy", () => {
  it("names a single evaluator and the dataset on screen", () => {
    const copy = getDeleteEvaluatorsCopy({
      evaluators: [{ name: "correctness", kind: "LLM" }],
      target: "dataset",
    });
    expect(copy.title).toBe("Delete evaluator");
    expect(copy.confirmLabel).toBe("Delete evaluator");
    expect(copy.description).toBe(
      "Remove “correctness” from this dataset. Its evaluation traces are deleted in the background. The evaluator is deleted only if it isn't used anywhere else."
    );
    expect(copy.successMessage).toBe(
      "Evaluator “correctness” was removed from this dataset."
    );
  });

  it("keeps built-in evaluators available", () => {
    expect(
      getDeleteEvaluatorsCopy({
        evaluators: [{ name: "exact_match", kind: "BUILTIN" }],
        target: "project",
      }).description
    ).toContain("The built-in evaluator remains available elsewhere.");
  });

  it("counts several evaluators across projects and datasets", () => {
    const copy = getDeleteEvaluatorsCopy({
      evaluators: [
        { name: "a", kind: "LLM" },
        { name: "b", kind: "CODE" },
        { name: "c", kind: "BUILTIN" },
      ],
      target: "anywhere",
    });
    expect(copy.title).toBe("Delete evaluators");
    expect(copy.confirmLabel).toBe("Delete 3 evaluators");
    expect(copy.description).toBe(
      "Remove 3 evaluators from their projects and datasets. Their evaluation traces are deleted in the background. Built-in evaluators remain available elsewhere, and the others are deleted only if they aren't used anywhere else."
    );
    expect(copy.successMessage).toBe(
      "3 evaluators were removed from their projects and datasets."
    );
  });

  it("uses the singular for one evaluator from any dataset", () => {
    expect(
      getDeleteEvaluatorsCopy({
        evaluators: [{ name: "a", kind: "CODE" }],
        target: "anyDataset",
      }).successMessage
    ).toBe("Evaluator “a” was removed from its dataset.");
  });
});

describe("getDeleteAssociatedLabel", () => {
  it("offers to delete prompts and decisions only when selected", () => {
    expect(getDeleteAssociatedLabel([{ kind: "CODE" }])).toBeNull();
    expect(getDeleteAssociatedLabel([{ kind: "BUILTIN" }])).toBeNull();
    expect(getDeleteAssociatedLabel([{ kind: "LLM" }])).toBe(
      "Delete associated prompt"
    );
    expect(getDeleteAssociatedLabel([{ kind: "LLM" }, { kind: "LLM" }])).toBe(
      "Delete associated prompts"
    );
    expect(getDeleteAssociatedLabel([{ kind: "DECISION" }])).toBe(
      "Delete associated decision"
    );
    expect(
      getDeleteAssociatedLabel([
        { kind: "LLM" },
        { kind: "DECISION" },
        { kind: "DECISION" },
      ])
    ).toBe("Delete associated prompt and decisions");
  });
});
