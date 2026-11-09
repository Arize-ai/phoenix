import { describe, expect, it } from "vitest";

import { getNameWithoutEvaluator } from "@phoenix/components/evaluators/EvaluatorOutputPreview";

/**
 * The test bench's result chips all belong to the evaluator being edited, so
 * they leave its name out: a single-output annotation shows no name and a
 * multi-output one shows only its output's name.
 */
describe("getNameWithoutEvaluator", () => {
  it("shows no name for an annotation named after the evaluator", () => {
    expect(
      getNameWithoutEvaluator({
        annotationName: "addresses-request-span",
        evaluatorName: "addresses-request-span",
      })
    ).toBeNull();
  });

  it("shows only the output's name for a multi-output annotation", () => {
    expect(
      getNameWithoutEvaluator({
        annotationName: "addresses-request-span.is_rude",
        evaluatorName: "addresses-request-span",
      })
    ).toBe("is_rude");
  });

  it("keeps a name that does not belong to the evaluator", () => {
    expect(
      getNameWithoutEvaluator({
        annotationName: "addresses-request-spans",
        evaluatorName: "addresses-request-span",
      })
    ).toBe("addresses-request-spans");
  });

  it("keeps the name when the evaluator has none yet", () => {
    expect(
      getNameWithoutEvaluator({
        annotationName: "relevance",
        evaluatorName: "",
      })
    ).toBe("relevance");
  });
});
