import { describe, expect, it } from "vitest";

import {
  getUIOperationDescriptor,
  renderUIOperationSignature,
} from "../../catalog";

function renderSignature(name: string) {
  const descriptor = getUIOperationDescriptor(name);

  if (!descriptor) throw new Error(`${name} is not in the catalog`);

  return renderUIOperationSignature({ descriptor, isMounted: true });
}

describe("playground task operations", () => {
  it("are catalogued under the playground namespace and the evaluator playground is gone", () => {
    for (const name of [
      "playground.task.select",
      "playground.instance.add",
      "playground.evaluator.read",
      "playground.evaluator.edit",
      "playground.evaluator.save",
      "playground.expectedOutput.set",
    ]) {
      expect(getUIOperationDescriptor(name)?.name).toBe(name);
    }

    expect(
      getUIOperationDescriptor("evaluatorPlayground.read")
    ).toBeUndefined();
  });

  it("renders every task source variant in the select signature", () => {
    const signature = renderSignature("playground.task.select");

    // A discriminated union converts to `oneOf`; each variant must render
    // rather than collapsing to `unknown`, or the model has to guess it.
    expect(signature).toContain('type: "new"; kind: "prompt" | "LLM" | "CODE"');
    expect(signature).toContain('type: "prompt"; promptId: string');
    expect(signature).toContain('type: "evaluator"; evaluatorId: string');
    expect(signature).toContain(
      'type: "datasetEvaluator"; datasetEvaluatorId: string'
    );
    expect(signature).toContain("discardChanges?: boolean");
    expect(signature).not.toContain("source: unknown");
  });

  it("renders the instance.add source with the duplicate variant and an optional input", () => {
    const signature = renderSignature("playground.instance.add");

    expect(signature).toContain("source?:");
    expect(signature).toContain('type: "duplicate"');
    expect(signature).toContain('type: "evaluator"; evaluatorId: string');
  });

  it("names the evaluator read's top-level fields in its result type", () => {
    const signature = renderSignature("playground.evaluator.read");

    for (const field of [
      "annotationName: string",
      "saveTarget:",
      "validationError:",
      "outputConfigRules: string",
      "revision: string",
    ]) {
      expect(signature).toContain(field);
    }
  });

  it("keeps no route hint that names a prompt mode", () => {
    for (const name of [
      "playground.run",
      "playground.prompt.read",
      "playground.dataset.load",
      "playground.model.set",
      "playground.variables.set",
    ]) {
      const hint = getUIOperationDescriptor(name)?.availability?.routeHint;
      expect(hint).toContain("/playground");
      expect(hint).not.toMatch(/prompt tasks|mode/);
    }
  });
});
