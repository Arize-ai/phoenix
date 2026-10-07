import { describe, expect, it } from "vitest";

import { getProjectEvaluatorFormContext } from "../useAdvertiseProjectEvaluatorForm";

describe("getProjectEvaluatorFormContext", () => {
  it("names the evaluator an edit form edits", () => {
    expect(
      getProjectEvaluatorFormContext({
        projectNodeId: "P1",
        projectEvaluatorNodeId: "PE1",
        form: "edit",
        evaluatorKind: "CODE",
      })
    ).toEqual({
      type: "project_evaluator",
      projectNodeId: "P1",
      projectEvaluatorNodeId: "PE1",
      form: "edit",
      evaluatorKind: "CODE",
    });
  });

  it("names no evaluator for a create form, even over an evaluator route", () => {
    expect(
      getProjectEvaluatorFormContext({
        projectNodeId: "P1",
        projectEvaluatorNodeId: "PE1",
        form: "create",
        evaluatorKind: "LLM",
      })
    ).toMatchObject({ projectEvaluatorNodeId: null, form: "create" });
  });

  it("advertises nothing outside a project route", () => {
    expect(
      getProjectEvaluatorFormContext({
        projectNodeId: undefined,
        projectEvaluatorNodeId: undefined,
        form: "create",
        evaluatorKind: "CODE",
      })
    ).toBeNull();
  });
});
