import { describe, expect, it } from "vitest";

import {
  getDecisionAnnotationName,
  resolveEffectiveProjections,
} from "../DecisionDatasetEvaluatorDetails";

type Q = Parameters<
  typeof resolveEffectiveProjections
>[0]["judgePolicy"][number];

const predicate = (name: string, threshold: number): Q => ({
  __typename: "DecisionPredicateProjection",
  name,
  optimizationDirection: "NONE",
  threshold,
});

describe("resolveEffectiveProjections", () => {
  it("inherits every question when the binding has no policy", () => {
    const judge = [predicate("a", 0.5), predicate("b", 0.5)];
    const result = resolveEffectiveProjections({
      judgePolicy: judge,
      bindingPolicy: null,
    });
    expect(result.map((r) => r.isOverridden)).toEqual([false, false]);
    expect(result.map((r) => r.projection)).toEqual(judge);
  });

  it("replaces only the questions the binding names, in judge order", () => {
    const result = resolveEffectiveProjections({
      judgePolicy: [predicate("a", 0.5), predicate("b", 0.5)],
      bindingPolicy: [predicate("b", 0.9)],
    });
    expect(result.map((r) => r.projection.name)).toEqual(["a", "b"]);
    expect(result.map((r) => r.isOverridden)).toEqual([false, true]);
    expect(result[1].projection).toMatchObject({ threshold: 0.9 });
  });
});

describe("getDecisionAnnotationName", () => {
  it("uses the binding name for a single question", () => {
    expect(
      getDecisionAnnotationName({
        bindingName: "judge",
        questionName: "q",
        questionCount: 1,
      })
    ).toBe("judge");
  });
  it("qualifies the name for several questions", () => {
    expect(
      getDecisionAnnotationName({
        bindingName: "judge",
        questionName: "q",
        questionCount: 2,
      })
    ).toBe("judge.q");
  });
});
