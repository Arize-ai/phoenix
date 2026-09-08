import {
  getCompareEvaluatorsDisabledReason,
  reconcileProjectEvaluatorSelection,
  type SelectedProjectEvaluator,
  toRowSelectionState,
} from "@phoenix/pages/project/evaluators/projectEvaluatorSelection";

const evaluator = (
  id: string,
  evaluationTarget: SelectedProjectEvaluator["evaluationTarget"] = "SPAN"
): SelectedProjectEvaluator => ({
  id,
  name: `Evaluator ${id}`,
  evaluationTarget,
});

describe("project evaluator selection", () => {
  it("requires exactly two evaluators with the same target", () => {
    expect(getCompareEvaluatorsDisabledReason({})).toBe(
      "Select two evaluators to compare"
    );
    expect(getCompareEvaluatorsDisabledReason({ a: evaluator("a") })).toBe(
      "Select two evaluators to compare"
    );
    expect(
      getCompareEvaluatorsDisabledReason({
        a: evaluator("a"),
        b: evaluator("b"),
        c: evaluator("c"),
      })
    ).toBe("Select exactly two evaluators to compare");
    expect(
      getCompareEvaluatorsDisabledReason({
        a: evaluator("a"),
        b: evaluator("b", "SESSION"),
      })
    ).toBe(
      "Both evaluators must evaluate the same target (span, trace, or session)"
    );
    expect(
      getCompareEvaluatorsDisabledReason({
        a: evaluator("a"),
        b: evaluator("b"),
      })
    ).toBeNull();
  });

  it("preserves unloaded rows, removes unchecked rows, and adds loaded rows", () => {
    const previousSelection = {
      unloaded: evaluator("unloaded"),
      removed: evaluator("removed"),
    };
    const added = evaluator("added", "SESSION");
    expect(
      reconcileProjectEvaluatorSelection({
        nextRowSelection: { unloaded: true, added: true },
        previousSelection,
        rowsById: { added },
      })
    ).toEqual({ unloaded: previousSelection.unloaded, added });
  });

  it("converts rich selection to TanStack row selection state", () => {
    expect(
      toRowSelectionState({ a: evaluator("a"), b: evaluator("b") })
    ).toEqual({
      a: true,
      b: true,
    });
  });
});
