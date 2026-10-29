import { describe, expect, it } from "vitest";

import {
  formatDecisionAnswers,
  getDecisionRunAnswers,
  getDecisionTaskQuestions,
} from "../decisionRunOutput";

const decisionTaskConfig = {
  __typename: "DecisionTaskConfig" as const,
  questions: [
    {
      __typename: "DecisionPredicateQuestion" as const,
      name: "is_recurring",
      instructions: "Is it recurring?",
      criteria: null,
    },
    {
      __typename: "DecisionChoiceQuestion" as const,
      name: "category",
      instructions: "Which category?",
      choices: [
        { value: "income", description: null },
        { value: "groceries", description: null },
        { value: "shopping", description: null },
      ],
    },
    {
      __typename: "DecisionScaleQuestion" as const,
      name: "urgency",
      instructions: "How urgent?",
      levels: [
        { label: "low", description: null },
        { label: "medium", description: null },
        { label: "high", description: null },
      ],
    },
  ],
};

const decisionQuestions = getDecisionTaskQuestions(decisionTaskConfig);

const output = {
  category: {
    type: "choice",
    choice: "groceries",
    confidence: 0.79,
    probabilities: { income: 0, groceries: 0.8, shopping: 0.2 },
  },
  urgency: {
    type: "scale",
    expected_level: 1.8,
    confidence: 0.6,
    probabilities: { 0: 0.1, 1: 0.0, 2: 0.9 },
  },
  is_recurring: { type: "predicate", probability: 0.1 },
};

describe("getDecisionRunAnswers", () => {
  it("reads every answer in the experiment's question order", () => {
    const answers = getDecisionRunAnswers({
      questions: decisionQuestions,
      output,
    });
    expect(answers?.map((answer) => answer.name)).toEqual([
      "is_recurring",
      "category",
      "urgency",
    ]);
    const category = answers?.[1];
    expect(category?.kind).toBe("choice");
    if (category?.kind === "choice") {
      expect(category.probabilities.map((entry) => entry.value)).toEqual([
        "groceries",
        "shopping",
      ]);
    }
  });

  it("reads a single-question output, including one sent as a JSON string", () => {
    expect(
      getDecisionRunAnswers({
        questions: decisionQuestions,
        output: JSON.stringify({ is_recurring: output.is_recurring }),
      })
    ).toEqual([{ kind: "predicate", name: "is_recurring", probability: 0.1 }]);
  });

  it("keeps refused questions beside answered ones", () => {
    const answers = getDecisionRunAnswers({
      questions: decisionQuestions,
      output: { ...output, category: { type: "refusal" } },
    });
    expect(answers?.map((answer) => answer.kind)).toEqual([
      "predicate",
      "refusal",
      "scale",
    ]);
  });

  it("names scale levels by each experiment's own levels", () => {
    const otherQuestions = getDecisionTaskQuestions({
      __typename: "DecisionTaskConfig",
      questions: [
        {
          __typename: "DecisionScaleQuestion",
          name: "urgency",
          instructions: "How urgent?",
          levels: [
            { label: "calm", description: null },
            { label: "soon", description: null },
            { label: "now", description: null },
          ],
        },
      ],
    });
    const labelsFor = (questions: typeof decisionQuestions) => {
      const [answer] =
        getDecisionRunAnswers({
          questions,
          output: { urgency: output.urgency },
        }) ?? [];
      return answer?.kind === "scale"
        ? answer.levels.map((level) => level.label)
        : null;
    };
    expect(labelsFor(decisionQuestions)).toEqual(["low", "medium", "high"]);
    expect(labelsFor(otherQuestions)).toEqual(["calm", "soon", "now"]);
  });

  it.each([
    ["a missing output", null],
    ["an empty output", {}],
    ["a non-object output", "plain text"],
    ["an output with a non-answer field", { ...output, note: "hi" }],
  ])("falls back to the raw output for %s", (_, value) => {
    expect(
      getDecisionRunAnswers({ questions: decisionQuestions, output: value })
    ).toBeNull();
  });

  it("falls back to the raw output for other tasks", () => {
    const questions = getDecisionTaskQuestions({
      __typename: "PromptTaskConfig",
    });
    expect(questions).toBeNull();
    expect(getDecisionRunAnswers({ questions, output })).toBeNull();
    expect(getDecisionTaskQuestions(null)).toBeNull();
  });
});

describe("formatDecisionAnswers", () => {
  const answers =
    getDecisionRunAnswers({
      questions: decisionQuestions,
      output: { ...output, urgency: { type: "refusal" } },
    }) ?? [];

  it("puts every answer on one line, every non-negligible option included", () => {
    expect(formatDecisionAnswers(answers)).toBe(
      "is_recurring: False 90% · category: groceries 80%, shopping 20% · urgency: Refused"
    );
  });

  it("names a scale answer by its nearest level", () => {
    const urgency =
      getDecisionRunAnswers({
        questions: decisionQuestions,
        output: { urgency: output.urgency },
      }) ?? [];
    expect(formatDecisionAnswers(urgency)).toBe("urgency: high (1.80)");
  });
});
