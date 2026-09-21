import {
  getCompareEvaluatorsDisabledReason,
  reconcileProjectEvaluatorSelection,
  type ProjectEvaluatorSelection,
  toRowSelectionState,
} from "@phoenix/pages/project/evaluators/projectEvaluatorSelection";

describe("project evaluator selection", () => {
  it("requires exactly two evaluators with the same target", () => {
    expect(getCompareEvaluatorsDisabledReason({})).toBe(
      "Select two evaluators to compare"
    );
    expect(getCompareEvaluatorsDisabledReason({ a: "SPAN" })).toBe(
      "Select two evaluators to compare"
    );
    expect(
      getCompareEvaluatorsDisabledReason({
        a: "SPAN",
        b: "SPAN",
        c: "SPAN",
      })
    ).toBe("Select exactly two evaluators to compare");
    expect(
      getCompareEvaluatorsDisabledReason({
        a: "SPAN",
        b: "SESSION",
      })
    ).toBe(
      "Both evaluators must evaluate the same target (span, trace, or session)"
    );
    expect(
      getCompareEvaluatorsDisabledReason({
        a: "SPAN",
        b: "SPAN",
      })
    ).toBeNull();
  });

  it("preserves unloaded rows, removes unchecked rows, and adds loaded rows", () => {
    const previousSelection: ProjectEvaluatorSelection = {
      unloaded: "SPAN",
      removed: "SPAN",
    };
    expect(
      reconcileProjectEvaluatorSelection({
        nextRowSelection: { unloaded: true, added: true },
        previousSelection,
        targetsById: { added: "SESSION" },
      })
    ).toEqual({ unloaded: "SPAN", added: "SESSION" });
  });

  it("converts target selection to TanStack row selection state", () => {
    expect(toRowSelectionState({ a: "SPAN", b: "SPAN" })).toEqual({
      a: true,
      b: true,
    });
  });
});
