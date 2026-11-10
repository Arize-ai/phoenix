import {
  getCompareEvaluatorsDisabledReason,
  getSelectedProjectEvaluators,
  reconcileProjectEvaluatorSelection,
  type ProjectEvaluatorSelection,
  toRowSelectionState,
} from "@phoenix/pages/project/evaluators/projectEvaluatorSelection";
import type { ProjectEvaluatorTarget } from "@phoenix/pages/project/evaluators/projectEvaluatorTypes";

function selected(evaluationTarget: ProjectEvaluatorTarget) {
  return { evaluationTarget, name: "evaluator", kind: "LLM" } as const;
}

describe("project evaluator selection", () => {
  it("requires exactly two evaluators with the same target", () => {
    expect(getCompareEvaluatorsDisabledReason({})).toBe(
      "Select two evaluators to compare"
    );
    expect(getCompareEvaluatorsDisabledReason({ a: selected("SPAN") })).toBe(
      "Select two evaluators to compare"
    );
    expect(
      getCompareEvaluatorsDisabledReason({
        a: selected("SPAN"),
        b: selected("SPAN"),
        c: selected("SPAN"),
      })
    ).toBe("Select exactly two evaluators to compare");
    expect(
      getCompareEvaluatorsDisabledReason({
        a: selected("SPAN"),
        b: selected("SESSION"),
      })
    ).toBe(
      "Both evaluators must evaluate the same target (span, trace, or session)"
    );
    expect(
      getCompareEvaluatorsDisabledReason({
        a: selected("SPAN"),
        b: selected("SPAN"),
      })
    ).toBeNull();
  });

  it("preserves unloaded rows, removes unchecked rows, and adds loaded rows", () => {
    const previousSelection: ProjectEvaluatorSelection = {
      unloaded: selected("SPAN"),
      removed: selected("SPAN"),
    };
    expect(
      reconcileProjectEvaluatorSelection({
        nextRowSelection: { unloaded: true, added: true },
        previousSelection,
        evaluatorsById: { added: selected("SESSION") },
      })
    ).toEqual({ unloaded: selected("SPAN"), added: selected("SESSION") });
  });

  it("converts the selection to TanStack row selection state", () => {
    expect(
      toRowSelectionState({ a: selected("SPAN"), b: selected("SPAN") })
    ).toEqual({
      a: true,
      b: true,
    });
  });
});

describe("getSelectedProjectEvaluators", () => {
  it("lists the selected evaluators to delete", () => {
    expect(
      getSelectedProjectEvaluators({
        a: { evaluationTarget: "SPAN", name: "first", kind: "LLM" },
        b: { evaluationTarget: "TRACE", name: "second", kind: "CODE" },
      })
    ).toEqual([
      { id: "a", name: "first", kind: "LLM" },
      { id: "b", name: "second", kind: "CODE" },
    ]);
  });
});
