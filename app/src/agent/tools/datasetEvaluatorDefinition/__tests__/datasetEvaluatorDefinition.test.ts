import type { EvaluatorItem } from "@phoenix/components/evaluators/EvaluatorSelectMenuItem";

import { createReadDatasetEvaluatorDefinitionClientAction } from "../clientActions";
import type { ReadEvaluatorDefinitionResult } from "../readDatasetEvaluatorDefinition";
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

function okResult(datasetEvaluatorId: string): ReadEvaluatorDefinitionResult {
  return {
    ok: true,
    definition: {
      datasetEvaluatorId,
      name: "Exact Match",
      kind: "CODE",
      isBuiltin: false,
      definition: { sourceCode: "return 1" },
    },
  };
}

describe("read_dataset_evaluator_definition client action", () => {
  beforeEach(() => {
    readDatasetEvaluatorDefinition.mockReset();
  });

  it("returns one definition per id in request order", async () => {
    const evaluators = [evaluator({ id: "a" }), evaluator({ id: "b" })];
    readDatasetEvaluatorDefinition.mockImplementation(
      async ({ datasetEvaluatorId }: { datasetEvaluatorId: string }) =>
        okResult(datasetEvaluatorId)
    );
    const action = createReadDatasetEvaluatorDefinitionClientAction({
      datasetId: "RGF0YXNldDox",
      getEvaluators: () => evaluators,
    });

    const result = await action({ datasetEvaluatorIds: ["b", "a"] });

    expect(result.ok).toBe(true);
    if (result.ok) {
      const parsed = JSON.parse(result.output!);
      expect(
        parsed.datasetEvaluatorDefinitions.map(
          (def: { datasetEvaluatorId: string }) => def.datasetEvaluatorId
        )
      ).toEqual(["b", "a"]);
    }
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

  it("returns the definitions that resolved plus per-id errors when one fetch fails", async () => {
    const evaluators = [evaluator({ id: "a" }), evaluator({ id: "b" })];
    readDatasetEvaluatorDefinition.mockImplementation(
      async ({ datasetEvaluatorId }: { datasetEvaluatorId: string }) =>
        datasetEvaluatorId === "b"
          ? { ok: false, error: "Failed to read evaluator b." }
          : okResult(datasetEvaluatorId)
    );
    const action = createReadDatasetEvaluatorDefinitionClientAction({
      datasetId: "RGF0YXNldDox",
      getEvaluators: () => evaluators,
    });

    const result = await action({ datasetEvaluatorIds: ["a", "b"] });

    expect(result.ok).toBe(true);
    if (result.ok) {
      const parsed = JSON.parse(result.output!);
      expect(
        parsed.datasetEvaluatorDefinitions.map(
          (def: { datasetEvaluatorId: string }) => def.datasetEvaluatorId
        )
      ).toEqual(["a"]);
      expect(parsed.errors).toEqual([
        { datasetEvaluatorId: "b", error: "Failed to read evaluator b." },
      ]);
    }
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
