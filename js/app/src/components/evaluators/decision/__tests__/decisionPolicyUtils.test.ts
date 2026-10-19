import { describe, expect, it } from "vitest";

import type {
  DecisionProjectionPolicyValue,
  DecisionQuestionDefinition,
} from "../decisionPolicyUtils";
import {
  buildDefaultPolicy,
  computePolicyOverride,
  mergePolicyOverride,
  normalizePolicy,
  policyOutputToInput,
  toDecisionQuestionDefinitions,
  validatePolicy,
} from "../decisionPolicyUtils";

const questions: DecisionQuestionDefinition[] = [
  { type: "predicate", name: "accurate" },
  { type: "choice", name: "tone", choices: ["good", "ok", "bad"] },
  { type: "scale", name: "clarity", levels: ["low", "high"] },
];

const base: DecisionProjectionPolicyValue = {
  questions: [
    {
      predicate: {
        name: "accurate",
        threshold: 0.7,
        optimizationDirection: "MAXIMIZE",
      },
    },
    {
      choice: {
        name: "tone",
        scores: [
          { choice: "good", score: 1 },
          { choice: "bad", score: 0 },
        ],
        optimizationDirection: "MAXIMIZE",
      },
    },
    {
      scale: {
        name: "clarity",
        includeLabel: false,
        optimizationDirection: "NONE",
      },
    },
  ],
};

describe("decisionPolicyUtils", () => {
  it("converts GraphQL output to the input shape", () => {
    expect(
      policyOutputToInput({
        questions: [
          {
            __typename: "DecisionPredicateProjection",
            name: "accurate",
            optimizationDirection: "MAXIMIZE",
            threshold: 0.7,
          },
          {
            __typename: "DecisionChoiceProjection",
            name: "tone",
            optimizationDirection: "NONE",
            scores: [{ choice: "good", score: 1 }],
          },
          {
            __typename: "DecisionScaleProjection",
            name: "clarity",
            optimizationDirection: "MINIMIZE",
            includeLabel: true,
          },
          { __typename: "%other" },
        ],
      })
    ).toEqual({
      questions: [
        {
          predicate: {
            name: "accurate",
            threshold: 0.7,
            optimizationDirection: "MAXIMIZE",
          },
        },
        {
          choice: {
            name: "tone",
            scores: [{ choice: "good", score: 1 }],
            optimizationDirection: "NONE",
          },
        },
        {
          scale: {
            name: "clarity",
            includeLabel: true,
            optimizationDirection: "MINIMIZE",
          },
        },
      ],
    });
  });

  it("converts version questions to definitions", () => {
    expect(
      toDecisionQuestionDefinitions([
        { __typename: "DecisionPredicateQuestion", name: "a" },
        {
          __typename: "DecisionChoiceQuestion",
          name: "b",
          choices: [{ value: "x" }],
        },
        {
          __typename: "DecisionScaleQuestion",
          name: "c",
          levels: [{ label: "lo" }],
        },
      ])
    ).toEqual([
      { type: "predicate", name: "a" },
      { type: "choice", name: "b", choices: ["x"] },
      { type: "scale", name: "c", levels: ["lo"] },
    ]);
  });

  it("builds defaults in declared order", () => {
    const policy = buildDefaultPolicy(questions);
    expect(policy.questions).toHaveLength(3);
    expect(policy.questions[0]).toEqual({
      predicate: {
        name: "accurate",
        threshold: 0.5,
        optimizationDirection: "NONE",
      },
    });
    expect(policy.questions[1]).toEqual({
      choice: { name: "tone", scores: [], optimizationDirection: "NONE" },
    });
  });

  it("normalizes to declared questions and choice order", () => {
    const policy = normalizePolicy(questions, {
      questions: [
        {
          choice: {
            name: "tone",
            scores: [
              { choice: "bad", score: 0 },
              { choice: "gone", score: 5 },
              { choice: "good", score: 1 },
            ],
            optimizationDirection: "NONE",
          },
        },
        {
          predicate: {
            name: "removed",
            threshold: 1,
            optimizationDirection: "NONE",
          },
        },
      ],
    });
    expect(policy.questions).toHaveLength(3);
    expect(policy.questions[0]).toHaveProperty("predicate.name", "accurate");
    expect(policy.questions[1]).toHaveProperty("choice.scores", [
      { choice: "good", score: 1 },
      { choice: "bad", score: 0 },
    ]);
  });

  it("merges a sparse override over the base", () => {
    const override: DecisionProjectionPolicyValue = {
      questions: [
        {
          predicate: {
            name: "accurate",
            threshold: 0.9,
            optimizationDirection: "MAXIMIZE",
          },
        },
      ],
    };
    const merged = mergePolicyOverride(base, override);
    expect(merged.questions[0]).toEqual(override.questions[0]);
    expect(merged.questions.slice(1)).toEqual(base.questions.slice(1));
    expect(mergePolicyOverride(base, null)).toEqual(base);
  });

  it("computes only the changed questions as the override", () => {
    const edited: DecisionProjectionPolicyValue = {
      questions: [
        base.questions[0],
        {
          choice: {
            name: "tone",
            scores: [
              { choice: "bad", score: 0 },
              { choice: "good", score: 2 },
            ],
            optimizationDirection: "MAXIMIZE",
          },
        },
        base.questions[2],
      ],
    };
    expect(computePolicyOverride(base, edited)).toEqual({
      questions: [edited.questions[1]],
    });
    expect(computePolicyOverride(base, base)).toBeNull();
  });

  it("treats choice scores as equal regardless of order", () => {
    const reordered: DecisionProjectionPolicyValue = {
      questions: [
        base.questions[0],
        {
          choice: {
            name: "tone",
            scores: [
              { choice: "bad", score: 0 },
              { choice: "good", score: 1 },
            ],
            optimizationDirection: "MAXIMIZE",
          },
        },
        base.questions[2],
      ],
    };
    expect(computePolicyOverride(base, reordered)).toBeNull();
  });

  it("validates thresholds and scores per question", () => {
    expect(validatePolicy(base)).toEqual({});
    const invalid = validatePolicy({
      questions: [
        {
          predicate: {
            name: "accurate",
            threshold: 1.5,
            optimizationDirection: "NONE",
          },
        },
        {
          choice: {
            name: "tone",
            scores: [{ choice: "good", score: Infinity }],
            optimizationDirection: "NONE",
          },
        },
      ],
    });
    expect(invalid.accurate).toHaveLength(1);
    expect(invalid.tone).toHaveLength(1);
    expect(
      validatePolicy({
        questions: [
          {
            predicate: {
              name: "p",
              threshold: NaN,
              optimizationDirection: "NONE",
            },
          },
        ],
      }).p
    ).toBeDefined();
  });
});
