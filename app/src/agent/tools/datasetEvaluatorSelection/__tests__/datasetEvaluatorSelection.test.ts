import type { EvaluatorItem } from "@phoenix/components/evaluators/EvaluatorSelectMenuItem";

import { createSetDatasetEvaluatorSelectionClientAction } from "../clientActions";

function evaluator(overrides: Partial<EvaluatorItem> = {}): EvaluatorItem {
  return {
    id: "RXY6MQ==",
    kind: "CODE",
    isBuiltIn: false,
    name: "Exact Match",
    ...overrides,
  };
}

describe("set_dataset_evaluator_selection client action", () => {
  it("replaces the applied set with exactly the requested ids", async () => {
    const evaluators = [
      evaluator({ id: "a" }),
      evaluator({ id: "b" }),
      evaluator({ id: "c" }),
    ];
    let selected: string[] = ["a"];
    const action = createSetDatasetEvaluatorSelectionClientAction({
      getEvaluators: () => evaluators,
      setSelectedDatasetEvaluatorIds: (ids) => {
        selected = ids;
      },
    });

    const result = await action({ datasetEvaluatorIds: ["b", "c"] });

    expect(result.ok).toBe(true);
    expect(selected).toEqual(["b", "c"]);
  });

  it("rejects ids that are no longer on the live roster without applying", async () => {
    const evaluators = [evaluator({ id: "a" })];
    let selected: string[] = ["a"];
    const action = createSetDatasetEvaluatorSelectionClientAction({
      getEvaluators: () => evaluators,
      setSelectedDatasetEvaluatorIds: (ids) => {
        selected = ids;
      },
    });

    const result = await action({ datasetEvaluatorIds: ["a", "deleted"] });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("deleted");
    }
    expect(selected).toEqual(["a"]);
  });

  it("bounds an oversized evaluator name in the output echo", async () => {
    const longName = "n".repeat(500);
    const evaluators = [evaluator({ id: "a", name: longName })];
    const action = createSetDatasetEvaluatorSelectionClientAction({
      getEvaluators: () => evaluators,
      setSelectedDatasetEvaluatorIds: () => {},
    });

    const result = await action({ datasetEvaluatorIds: ["a"] });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output).not.toContain(longName);
      expect(result.output).toContain("…");
    }
  });

  it("rejects invalid input", async () => {
    const action = createSetDatasetEvaluatorSelectionClientAction({
      getEvaluators: () => [],
      setSelectedDatasetEvaluatorIds: () => {},
    });

    const result = await action({ datasetEvaluatorIds: [123] });

    expect(result).toEqual(
      expect.objectContaining({
        ok: false,
        error: "Invalid set_dataset_evaluator_selection input.",
      })
    );
  });
});
