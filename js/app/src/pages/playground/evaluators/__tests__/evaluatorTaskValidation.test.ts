import { describe, expect, it } from "vitest";

import { getEvaluatorOutputConfigValidationErrors } from "@phoenix/components/evaluators/utils";
import { createPlaygroundEvaluatorTask } from "@phoenix/store/playground";

import {
  getCodeEvaluatorValidationError,
  getDefaultSandboxConfigId,
  getEvaluatorTaskValidationError,
} from "../evaluatorTaskValidation";

const pythonDraft = {
  sourceCode: 'def evaluate(output):\n    return "pass"',
  language: "PYTHON" as const,
  sandboxConfigId: "python",
  sandboxConfigs: [
    { id: "python", language: "PYTHON" as const },
    { id: "typescript", language: "TYPESCRIPT" as const },
  ],
};

describe("code evaluator preflight", () => {
  it("requires executable source and an available sandbox", () => {
    expect(getCodeEvaluatorValidationError(pythonDraft)).toBeNull();
    expect(
      getCodeEvaluatorValidationError({ ...pythonDraft, sourceCode: " \n\t " })
    ).toContain("Enter evaluator code");
    expect(
      getCodeEvaluatorValidationError({ ...pythonDraft, sandboxConfigId: null })
    ).toContain("Select a sandbox");
    expect(
      getCodeEvaluatorValidationError({ ...pythonDraft, sandboxConfigs: [] })
    ).toContain("unavailable");
  });
  it("rejects a previously selected sandbox after changing code language", () => {
    expect(
      getCodeEvaluatorValidationError({
        ...pythonDraft,
        language: "TYPESCRIPT",
      })
    ).toContain("supports the evaluator language");
    expect(
      getCodeEvaluatorValidationError({
        ...pythonDraft,
        language: "TYPESCRIPT",
        sandboxConfigId: "typescript",
      })
    ).toBeNull();
  });
});

describe("default sandbox selection", () => {
  const sandboxConfigs = [
    { id: "ts-1", language: "TYPESCRIPT" as const },
    { id: "py-1", language: "PYTHON" as const },
    { id: "py-2", language: "PYTHON" as const },
  ];

  it("keeps a compatible preferred sandbox", () => {
    expect(
      getDefaultSandboxConfigId({
        sandboxConfigs,
        language: "PYTHON",
        preferredId: "py-2",
      })
    ).toBe("py-2");
  });
  it("falls back to the first compatible sandbox", () => {
    expect(
      getDefaultSandboxConfigId({ sandboxConfigs, language: "PYTHON" })
    ).toBe("py-1");
    expect(
      getDefaultSandboxConfigId({
        sandboxConfigs,
        language: "TYPESCRIPT",
        preferredId: "py-1",
      })
    ).toBe("ts-1");
  });
  it("returns null when nothing supports the language", () => {
    expect(
      getDefaultSandboxConfigId({
        sandboxConfigs: [sandboxConfigs[0]],
        language: "PYTHON",
      })
    ).toBeNull();
  });
});

describe("output config kind rule", () => {
  const categorical = {
    name: "quality",
    optimizationDirection: "MAXIMIZE" as const,
    values: [
      { label: "poor", score: 0 },
      { label: "good", score: 1 },
    ],
  };

  const continuous = {
    name: "quality",
    optimizationDirection: "MAXIMIZE" as const,
    lowerBound: 0,
    upperBound: 1,
  };

  it("rejects a continuous output on an LLM evaluator, naming the fix", () => {
    const errors = getEvaluatorOutputConfigValidationErrors({
      kind: "LLM",
      configs: [continuous],
    });

    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("only support categorical outputs");
    expect(errors[0]).toContain('"quality"');
  });
  it("accepts categorical outputs on an LLM evaluator and any output on code", () => {
    expect(
      getEvaluatorOutputConfigValidationErrors({
        kind: "LLM",
        configs: [categorical],
      })
    ).toEqual([]);
    expect(
      getEvaluatorOutputConfigValidationErrors({
        kind: "CODE",
        configs: [continuous],
      })
    ).toEqual([]);
  });
});

describe("task name rule", () => {
  const validate = (name: string) =>
    getEvaluatorTaskValidationError({
      evaluator: createPlaygroundEvaluatorTask({
        kind: "CODE",
        name,
        code: {
          language: "PYTHON",
          sourceCode: pythonDraft.sourceCode,
          sandboxConfigId: "python",
        },
      }),
      sandboxConfigs: pythonDraft.sandboxConfigs,
      buildPreview: () => {
        throw new Error("not reached for code evaluators");
      },
    });

  it("accepts an identifier or no name and rejects anything else first", () => {
    expect(validate("correctness")).toBeNull();
    expect(validate("")).toBeNull();
    expect(validate("My Evaluator")).toContain("Evaluator name");
    expect(validate("correctness-")).toContain("start and end");
  });
});
