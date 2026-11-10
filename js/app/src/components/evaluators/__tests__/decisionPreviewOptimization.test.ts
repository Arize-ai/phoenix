import { describe, expect, it } from "vitest";

import { deriveDecisionOutputConfigs } from "@phoenix/components/evaluators/decision/decisionPolicyUtils";
import type {
  DecisionOptimizationDirection,
  DecisionQuestionDefinition,
} from "@phoenix/components/evaluators/decision/decisionPolicyUtils";
import { getTypedOutputConfigOptimizationValue } from "@phoenix/components/evaluators/utils";

/**
 * A decision evaluator's preview chips colour against outputs derived from
 * the draft (#17632): the direction marks which answer is good and the
 * threshold is where a Yes / No answer turns, so a direction flip recolours
 * a result without re-running it.
 */
describe("decision preview colouring", () => {
  const predicateOnly: DecisionQuestionDefinition[] = [
    { type: "predicate", name: "addresses_request" },
  ];
  const draft = (
    optimizationDirection: DecisionOptimizationDirection,
    threshold = 0.5
  ) =>
    deriveDecisionOutputConfigs(predicateOnly, {
      questions: [
        {
          predicate: {
            name: "addresses_request",
            threshold,
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

  it("pivots at the threshold, where the true / false label flips", () => {
    // Labelled false under a 0.8 threshold, so bad when true is good.
    expect(valueOf(draft("MAXIMIZE", 0.8), 0.7)).toBeLessThan(0);
    expect(valueOf(draft("MAXIMIZE", 0.8), 0.9)).toBeGreaterThan(0);
    // Labelled true under a 0.3 threshold, so good when true is good.
    expect(valueOf(draft("MAXIMIZE", 0.3), 0.4)).toBeGreaterThan(0);
    expect(valueOf(draft("MINIMIZE", 0.3), 0.4)).toBeLessThan(0);
  });

  it("leaves results neutral when neither answer is good", () => {
    expect(valueOf(draft("NONE"), 0.86)).toBeNull();
  });

  it("splits at the threshold, not at 0.5", () => {
    expect(valueOf(draft("MAXIMIZE", 0.8), 0.7)).toBeLessThan(0);
    expect(valueOf(draft("MAXIMIZE", 0.8), 0.85)).toBeGreaterThan(0);
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
