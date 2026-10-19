import { describe, expect, it } from "vitest";

import type { DecisionQuestionDefinition } from "@phoenix/components/evaluators/decision/decisionPolicyUtils";

import { pruneBindingOverride } from "../decisionDatasetEvaluatorUtils";

describe("pruneBindingOverride", () => {
  const questions: DecisionQuestionDefinition[] = [
    { name: "team", type: "choice", choices: ["billing", "other"] },
    { name: "urgent", type: "predicate" },
  ];

  it("keeps settings that fit, dropping scores for choices no longer offered", () => {
    expect(
      pruneBindingOverride(
        {
          questions: [
            {
              choice: {
                name: "team",
                optimizationDirection: "MAXIMIZE",
                scores: [
                  { choice: "technical", score: 1 },
                  { choice: "billing", score: 0.5 },
                ],
              },
            },
            // A scale override for what is now a predicate is dropped.
            {
              scale: {
                name: "urgent",
                optimizationDirection: "NONE",
                includeLabel: true,
              },
            },
            {
              predicate: {
                name: "removed",
                optimizationDirection: "NONE",
                threshold: 0.7,
              },
            },
          ],
        },
        questions
      )
    ).toEqual({
      questions: [
        {
          choice: {
            name: "team",
            optimizationDirection: "MAXIMIZE",
            scores: [{ choice: "billing", score: 0.5 }],
          },
        },
      ],
    });
  });

  it("is null when nothing fits", () => {
    expect(pruneBindingOverride(null, questions)).toBeNull();
  });
});
