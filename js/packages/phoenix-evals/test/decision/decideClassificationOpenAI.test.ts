/**
 * Runs the real `@ai-sdk/openai` decision model against a mocked `fetch`, so
 * mismatches between the `ai` version phoenix-evals depends on and the
 * provider's decision model implementation fail here. Mocking the model
 * object itself can't catch those.
 */
import { createOpenAI } from "@ai-sdk/openai";
import { describe, expect, it } from "vitest";

import {
  ClassificationRefusalError,
  createCorrectnessEvaluator,
} from "../../src";

type CapturedRequest = { url: string; body: Record<string, unknown> };

function createDecisionModel(answer: Record<string, unknown>) {
  const requests: CapturedRequest[] = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    requests.push({
      url: String(input),
      body: JSON.parse(String(init?.body)) as Record<string, unknown>,
    });
    return new Response(
      JSON.stringify({
        model: "gpt-6-luna",
        answers: [answer],
        usage: { input_tokens: 310, output_tokens: 0, total_tokens: 310 },
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    );
  };
  const openai = createOpenAI({ apiKey: "test-key", fetch });
  return { model: openai.decisionModel("gpt-6-luna"), requests };
}

describe("phoenix-evals with @ai-sdk/openai decision models", () => {
  it("classifies through the OpenAI Decisions API", async () => {
    const { model, requests } = createDecisionModel({
      type: "choice",
      name: "label",
      choice: "incorrect",
      confidence: 0.96,
      probabilities: [
        { value: "correct", probability: 0.02 },
        { value: "incorrect", probability: 0.98 },
      ],
    });
    const evaluator = createCorrectnessEvaluator({
      model,
      telemetry: { isEnabled: false },
    });

    const result = await evaluator.evaluate({
      input: "What is the capital of Australia?",
      output: "Sydney.",
    });

    expect(result).toEqual({
      label: "incorrect",
      score: 0,
      metadata: {
        probabilities: { correct: 0.02, incorrect: 0.98 },
        confidence: 0.96,
        modelId: "gpt-6-luna",
      },
    });
    expect(requests).toHaveLength(1);
    const [request] = requests;
    expect(request!.url).toBe("https://api.openai.com/v1/decisions");
    expect(JSON.stringify(request!.body)).toContain("Sydney.");
    expect(request!.body.questions).toEqual([
      {
        type: "choice",
        name: "label",
        instructions: expect.stringContaining("<rubric>"),
        choices: [{ value: "correct" }, { value: "incorrect" }],
      },
    ]);
  });

  it("surfaces a refusal as a ClassificationRefusalError", async () => {
    const { model } = createDecisionModel({ type: "refusal", name: "label" });
    const evaluator = createCorrectnessEvaluator({
      model,
      telemetry: { isEnabled: false },
    });

    await expect(
      evaluator.evaluate({ input: "", output: "" })
    ).rejects.toBeInstanceOf(ClassificationRefusalError);
  });
});
