import { describe, expect, it } from "vitest";

import { getEvaluatorOutputConfigValidationErrors } from "@phoenix/components/evaluators/utils";

import {
  getCodeSlotValidationError,
  getDefaultSandboxConfigId,
  getSlotSourceLabel,
} from "../evaluatorSlotValidation";

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
    expect(getCodeSlotValidationError(pythonDraft)).toBeNull();
    expect(
      getCodeSlotValidationError({ ...pythonDraft, sourceCode: " \n\t " })
    ).toContain("Enter evaluator code");
    expect(
      getCodeSlotValidationError({ ...pythonDraft, sandboxConfigId: null })
    ).toContain("Select a sandbox");
    expect(
      getCodeSlotValidationError({ ...pythonDraft, sandboxConfigs: [] })
    ).toContain("unavailable");
  });
  it("rejects a previously selected sandbox after changing code language", () => {
    expect(
      getCodeSlotValidationError({ ...pythonDraft, language: "TYPESCRIPT" })
    ).toContain("supports the evaluator language");
    expect(
      getCodeSlotValidationError({
        ...pythonDraft,
        language: "TYPESCRIPT",
        sandboxConfigId: "typescript",
      })
    ).toBeNull();
  });
});

describe("evaluator picker labels", () => {
  it("labels new drafts before collection items are mounted", () => {
    expect(
      getSlotSourceLabel({
        selection: "new-llm",
        sourceName: "Loading evaluator…",
        options: [],
      })
    ).toBe("New LLM evaluator");
    expect(
      getSlotSourceLabel({
        selection: "new-code",
        sourceName: "Loading evaluator…",
        options: [],
      })
    ).toBe("New code evaluator");
  });
  it("retains loaded names when filtered search results exclude the selection", () => {
    expect(
      getSlotSourceLabel({
        selection: "dataset-evaluator",
        sourceName: "refusal",
        options: [{ id: "other", name: "other" }],
      })
    ).toBe("refusal");
    expect(
      getSlotSourceLabel({
        selection: "global-evaluator",
        sourceName: "Loading evaluator…",
        options: [{ id: "global-evaluator", name: "quality" }],
      })
    ).toBe("quality");
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
