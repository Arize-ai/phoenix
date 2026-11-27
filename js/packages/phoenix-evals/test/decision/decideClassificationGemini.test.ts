/**
 * Runs the real `@ai-sdk/google` decision model against a mocked `fetch`, so
 * mismatches between the `ai` version phoenix-evals depends on and the
 * provider's decision model implementation fail here. Mocking the model
 * object itself can't catch those.
 */
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { Experimental_DecisionRefusalError } from "ai";
import { describe, expect, it } from "vitest";

import { createCorrectnessEvaluator } from "../../src";

type CapturedRequest = { url: string; body: Record<string, unknown> };

function createDecisionModel(response: Record<string, unknown>) {
  const requests: CapturedRequest[] = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    requests.push({
      url: String(input),
      body: JSON.parse(String(init?.body)) as Record<string, unknown>,
    });
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  const google = createGoogleGenerativeAI({ apiKey: "test-key", fetch });
  return { model: google.decisionModel("gemini-decision-1"), requests };
}

describe("phoenix-evals with @ai-sdk/google decision models", () => {
  it("classifies through the Gemini Decisions API", async () => {
    const { model, requests } = createDecisionModel({
      answers: {
        label: {
          type: "choice",
          choice: "incorrect",
          probabilities: { correct: 0.02, incorrect: 0.98 },
          confidence: 0.96,
        },
      },
      usage: { total_input_tokens: 310, total_output_tokens: 0 },
      prompt_feedback: { block_reason: null },
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
        modelId: "gemini-decision-1",
      },
    });
    expect(requests).toHaveLength(1);
    const [request] = requests;
    expect(request!.url).toBe(
      "https://generativelanguage.googleapis.com/v1beta/decisions"
    );
    expect(JSON.stringify(request!.body)).toContain("Sydney.");
    expect(request!.body.questions).toMatchObject({
      label: {
        type: "choice",
        instructions: "Select the single best label for the input.",
        criteria: { correct: null, incorrect: null },
      },
    });
  });

  it("surfaces a safety block as the AI SDK's refusal error", async () => {
    const { model } = createDecisionModel({
      answers: null,
      prompt_feedback: { block_reason: "safety" },
    });
    const evaluator = createCorrectnessEvaluator({
      model,
      telemetry: { isEnabled: false },
    });

    const error = await evaluator
      .evaluate({ input: "", output: "" })
      .catch((error: unknown) => error);
    expect(Experimental_DecisionRefusalError.isInstance(error)).toBe(true);
  });
});
