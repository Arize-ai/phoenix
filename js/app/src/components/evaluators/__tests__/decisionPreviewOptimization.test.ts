import { describe, expect, it } from "vitest";

import { deriveDecisionOutputConfigs } from "@phoenix/components/evaluators/decision/decisionPolicyUtils";
import type {
  DecisionOptimizationDirection,
  DecisionQuestionDefinition,
} from "@phoenix/components/evaluators/decision/decisionPolicyUtils";
import { getTypedOutputConfigOptimizationValue } from "@phoenix/components/evaluators/utils";

/**
 * A decision evaluator's preview chips colour against outputs derived from
 * the draft (#17632): the direction marks which answer is good, so a
 * direction flip recolours a result without re-running it.
 */
describe("decision preview colouring", () => {
  const predicateOnly: DecisionQuestionDefinition[] = [
    { type: "predicate", name: "addresses_request" },
  ];
  const draft = (optimizationDirection: DecisionOptimizationDirection) =>
    deriveDecisionOutputConfigs(predicateOnly, {
      questions: [
        {
          predicate: {
            name: "addresses_request",
            threshold: 0.5,
            optimizationDirection,
          },
        },
      ],
    });
  const valueOf = (
    outputConfigs: ReturnType<typeof draft>,
    score: number,
    annotationName = "addresses-request-span"
  ) =>
    getTypedOutputConfigOptimizationValue({
      annotationName,
      score,
      evaluatorName: "addresses-request-span",
      outputConfigs,
    });

  it("colours a true answer good when true is good and bad when false is", () => {
    expect(valueOf(draft("MAXIMIZE"), 0.86)).toBeGreaterThan(0);
    expect(valueOf(draft("MINIMIZE"), 0.86)).toBeLessThan(0);
    expect(valueOf(draft("MAXIMIZE"), 0.05)).toBeLessThan(0);
    expect(valueOf(draft("MINIMIZE"), 0.05)).toBeGreaterThan(0);
  });

  it("leaves results neutral when neither answer is good", () => {
    expect(valueOf(draft("NONE"), 0.86)).toBeNull();
  });

  it("matches a multi-question result by its evaluatorName.question name", () => {
    const outputConfigs = deriveDecisionOutputConfigs(
      [
        { type: "predicate", name: "accurate" },
        { type: "predicate", name: "harmful" },
      ],
      {
        questions: [
          {
            predicate: {
              name: "accurate",
              threshold: 0.5,
              optimizationDirection: "MAXIMIZE",
            },
          },
          {
            predicate: {
              name: "harmful",
              threshold: 0.5,
              optimizationDirection: "MINIMIZE",
            },
          },
        ],
      }
    );
    expect(
      valueOf(outputConfigs, 0.9, "addresses-request-span.accurate")
    ).toBeGreaterThan(0);
    expect(
      valueOf(outputConfigs, 0.9, "addresses-request-span.harmful")
    ).toBeLessThan(0);
    expect(valueOf(outputConfigs, 0.9, "other.harmful")).toBeNull();
  });
});
