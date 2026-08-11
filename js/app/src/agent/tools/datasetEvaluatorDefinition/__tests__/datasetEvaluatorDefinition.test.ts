import type { EvaluatorItem } from "@phoenix/components/evaluators/EvaluatorSelectMenuItem";

import { createReadDatasetEvaluatorDefinitionClientAction } from "../clientActions";
import {
  MAX_BODY_FIELD_CHARS,
  TRUNCATION_MARKER,
  truncateStringLeaves,
} from "../truncate";

const readDatasetEvaluatorDefinition = vi.hoisted(() => vi.fn());

vi.mock("../readDatasetEvaluatorDefinition", () => ({
  readDatasetEvaluatorDefinition,
}));

function evaluator(overrides: Partial<EvaluatorItem> = {}): EvaluatorItem {
  return {
    id: "RXY6MQ==",
    kind: "CODE",
    isBuiltIn: false,
    name: "Exact Match",
    ...overrides,
  };
}

describe("read_dataset_evaluator_definition client action", () => {
  beforeEach(() => {
    readDatasetEvaluatorDefinition.mockReset();
  });

  it("fails all-or-error without fetching when any id is off the roster", async () => {
    const evaluators = [evaluator({ id: "a" })];
    const action = createReadDatasetEvaluatorDefinitionClientAction({
      datasetId: "RGF0YXNldDox",
      getEvaluators: () => evaluators,
    });

    const result = await action({ datasetEvaluatorIds: ["a", "deleted"] });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("deleted");
      expect(result.error).toContain("Re-check the roster");
    }
    expect(readDatasetEvaluatorDefinition).not.toHaveBeenCalled();
  });

  it("fails only when every per-id fetch fails", async () => {
    const evaluators = [evaluator({ id: "a" }), evaluator({ id: "b" })];
    readDatasetEvaluatorDefinition.mockImplementation(
      async ({ datasetEvaluatorId }: { datasetEvaluatorId: string }) => ({
        ok: false,
        error: `Failed to read evaluator ${datasetEvaluatorId}.`,
      })
    );
    const action = createReadDatasetEvaluatorDefinitionClientAction({
      datasetId: "RGF0YXNldDox",
      getEvaluators: () => evaluators,
    });

    const result = await action({ datasetEvaluatorIds: ["a", "b"] });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("evaluator a");
      expect(result.error).toContain("evaluator b");
    }
  });

  it("rejects invalid input", async () => {
    const action = createReadDatasetEvaluatorDefinitionClientAction({
      datasetId: "RGF0YXNldDox",
      getEvaluators: () => [],
    });

    const result = await action({ datasetEvaluatorIds: [] });

    expect(result).toEqual(
      expect.objectContaining({
        ok: false,
        error: "Invalid read_dataset_evaluator_definition input.",
      })
    );
  });
});

describe("truncateStringLeaves", () => {
  it("caps an oversized string leaf with the truncation marker", () => {
    const long = "x".repeat(MAX_BODY_FIELD_CHARS + 100);
    const result = truncateStringLeaves({ sourceCode: long });

    expect(result.sourceCode).toHaveLength(
      MAX_BODY_FIELD_CHARS + TRUNCATION_MARKER.length
    );
    expect(result.sourceCode.endsWith(TRUNCATION_MARKER)).toBe(true);
  });

  it("preserves non-string scalars and nested structure", () => {
    const value = {
      includeExplanation: true,
      count: 3,
      nested: { messages: ["short", null] },
    };
    expect(truncateStringLeaves(value)).toEqual(value);
  });
});
