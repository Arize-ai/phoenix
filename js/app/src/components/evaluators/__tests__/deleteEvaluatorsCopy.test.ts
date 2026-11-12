import { describe, expect, it } from "vitest";

import {
  getDeleteAssociatedLabel,
  getDeleteEvaluatorsCopy,
} from "@phoenix/components/evaluators/deleteEvaluatorsCopy";

describe("getDeleteEvaluatorsCopy", () => {
  it("names a single evaluator", () => {
    expect(getDeleteEvaluatorsCopy([{ name: "correctness" }])).toEqual({
      title: "Delete evaluator",
      confirmLabel: "Delete evaluator",
      description:
        "Are you sure you want to delete evaluator correctness? This will also delete its evaluation traces, and it cannot be undone.",
      successTitle: "Evaluator deleted",
      successMessage: "Evaluator correctness has been deleted.",
    });
  });

  it("counts several evaluators in the title and the action", () => {
    expect(
      getDeleteEvaluatorsCopy([{ name: "a" }, { name: "b" }, { name: "c" }])
    ).toEqual({
      title: "Delete 3 evaluators",
      confirmLabel: "Delete 3 evaluators",
      description:
        "Are you sure you want to delete 3 evaluators? This will also delete their evaluation traces, and it cannot be undone.",
      successTitle: "Evaluators deleted",
      successMessage: "3 evaluators have been deleted.",
    });
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
