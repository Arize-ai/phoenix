import {
  EVALUATOR_SLOT_NAMES,
  getEvaluatorSlotDefaultPath,
  getEvaluatorSlotSuggestedKeys,
} from "../evaluatorSlotDefaults";

describe("evaluator slot defaults", () => {
  // The ghost path in the field is the only place these are written down, so
  // changing one changes what an author is told an unmapped slot will read.
  it("names the path every slot falls back to", () => {
    const defaults = Object.fromEntries(
      EVALUATOR_SLOT_NAMES.map((slotName) => [
        slotName,
        getEvaluatorSlotDefaultPath("span", slotName),
      ])
    );

    expect(defaults).toEqual({
      input: "span",
      output: "output",
      metadata: "metadata",
    });
    expect(getEvaluatorSlotDefaultPath("session", "input")).toBe("session");
  });

  it("pins a shortcut only where the record offers one", () => {
    expect(getEvaluatorSlotSuggestedKeys("span", "input")).toEqual([
      "input_value",
    ]);
    expect(getEvaluatorSlotSuggestedKeys("span", "output")).toEqual([]);
    expect(getEvaluatorSlotSuggestedKeys("session", "input")).toEqual([]);
  });
});
