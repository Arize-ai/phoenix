/**
 * Runs the real `@ai-sdk/openai` decision model against a mocked `fetch` for
 * the multi-criterion path, so the wire format sent for several questions and
 * parsed back into one result per criterion is exercised end to end.
 */
import { createOpenAI } from "@ai-sdk/openai";
import { describe, expect, it } from "vitest";

import { createClassificationEvaluator } from "../../src";

type CapturedRequest = { url: string; body: Record<string, unknown> };

function createDecisionModel(answers: Record<string, unknown>[]) {
  const requests: CapturedRequest[] = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    requests.push({
      url: String(input),
      body: JSON.parse(String(init?.body)) as Record<string, unknown>,
    });
    return new Response(
      JSON.stringify({
        model: "gpt-6-luna",
        answers,
        usage: { input_tokens: 310, output_tokens: 0, total_tokens: 310 },
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    );
  };
  const openai = createOpenAI({ apiKey: "test-key", fetch });
  return { model: openai.decisionModel("gpt-6-luna"), requests };
}

describe("multi-criterion classification with @ai-sdk/openai decision models", () => {
  it("asks every criterion in one decision request and returns one result each", async () => {
    const { model, requests } = createDecisionModel([
      {
        type: "choice",
        name: "sentiment",
        choice: "positive",
        confidence: 0.9,
        probabilities: [
          { value: "positive", probability: 0.9 },
          { value: "negative", probability: 0.1 },
        ],
      },
      {
        type: "choice",
        name: "toxicity",
        choice: "non_toxic",
        probabilities: [
          { value: "toxic", probability: 0.05 },
          { value: "non_toxic", probability: 0.95 },
        ],
      },
    ]);

    const evaluator = createClassificationEvaluator({
      name: "multi",
      model,
      telemetry: { isEnabled: false },
      promptTemplate: "Classify: {{text}}",
      choices: [
        {
          name: "sentiment",
          instruction: "Is the sentiment positive or negative?",
          choices: { positive: 1, negative: 0 },
        },
        {
          name: "toxicity",
          instruction: "Is the text toxic?",
          choices: { toxic: 1, non_toxic: 0 },
        },
      ],
    });

    const results = await evaluator.evaluateCriteria({ text: "I love this!" });

    expect(results).toEqual([
      {
        name: "sentiment",
        label: "positive",
        score: 1,
        explanation: undefined,
        metadata: {
          probabilities: { positive: 0.9, negative: 0.1 },
          confidence: 0.9,
          modelId: "gpt-6-luna",
        },
      },
      {
        name: "toxicity",
        label: "non_toxic",
        score: 0,
        explanation: undefined,
        metadata: {
          probabilities: { toxic: 0.05, non_toxic: 0.95 },
          modelId: "gpt-6-luna",
        },
      },
    ]);

    expect(requests).toHaveLength(1);
    const [request] = requests;
    expect(request!.url).toBe("https://api.openai.com/v1/decisions");
    expect(request!.body.questions).toEqual([
      {
        type: "choice",
        name: "sentiment",
        instructions: "Is the sentiment positive or negative?",
        choices: [{ value: "positive" }, { value: "negative" }],
      },
      {
        type: "choice",
        name: "toxicity",
        instructions: "Is the text toxic?",
        choices: [{ value: "toxic" }, { value: "non_toxic" }],
      },
    ]);
  });
});
