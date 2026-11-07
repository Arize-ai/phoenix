import { BadRequestError } from "openai";
import { describe, it, expect, beforeAll, afterAll } from "vitest";

import { startServer, stopServer, getBaseUrl, getTestClient } from "./setup";

describe("OpenAI Decisions API", () => {
  beforeAll(async () => {
    await startServer();
  });

  afterAll(async () => {
    await stopServer();
  });

  it("should answer predicate, choice, and score questions in order", async () => {
    const client = getTestClient();

    const decision = await client.decisions.create({
      model: "gpt-6-luna",
      input: "My invoice contains a duplicate charge.",
      questions: [
        {
          type: "predicate",
          name: "is_billing",
          instructions: "The ticket is about billing.",
        },
        {
          type: "choice",
          name: "team",
          instructions: "Which department should handle the ticket?",
          choices: [
            { value: "billing", description: "Charges and payments." },
            { value: "technical", description: "Product faults." },
            { value: true },
          ],
        },
        {
          type: "score",
          instructions: "How urgent is the ticket?",
          levels: [{ label: "low" }, { label: "medium" }, { label: "high" }],
        },
      ],
    });

    expect(decision.model).toBe("gpt-6-luna");
    expect(decision.answers).toHaveLength(3);

    const [predicate, choice, score] = decision.answers;

    expect(predicate.type).toBe("predicate");
    expect(predicate.name).toBe("is_billing");
    if (predicate.type === "predicate") {
      expect(predicate.probability).toBeGreaterThanOrEqual(0);
      expect(predicate.probability).toBeLessThanOrEqual(1);
    }

    expect(choice.type).toBe("choice");
    expect(choice.name).toBe("team");
    if (choice.type === "choice") {
      expect(choice.probabilities.map((p) => p.value)).toEqual([
        "billing",
        "technical",
        true,
      ]);
      const total = choice.probabilities.reduce((s, p) => s + p.probability, 0);
      expect(total).toBeCloseTo(1, 6);
      const selected = choice.probabilities.find(
        (p) => p.value === choice.choice
      );
      expect(selected?.probability).toBe(choice.confidence);
      expect(Math.max(...choice.probabilities.map((p) => p.probability))).toBe(
        choice.confidence
      );
    }

    expect(score.type).toBe("score");
    expect(score.name).toBeNull();
    if (score.type === "score") {
      expect(score.probabilities.map((p) => [p.label, p.value])).toEqual([
        ["low", 0],
        ["medium", 1],
        ["high", 2],
      ]);
      const expected = score.probabilities.reduce(
        (s, p) => s + p.value * p.probability,
        0
      );
      expect(score.score).toBeCloseTo(expected, 6);
      expect(score.score).toBeGreaterThanOrEqual(0);
      expect(score.score).toBeLessThanOrEqual(2);
    }

    expect(decision.usage.input_tokens).toBeGreaterThan(0);
    expect(decision.usage.output_tokens).toBe(3);
    expect(decision.usage.total_tokens).toBe(
      decision.usage.input_tokens + decision.usage.output_tokens
    );
  });

  it("should accept message-array input", async () => {
    const client = getTestClient();

    const decision = await client.decisions.create({
      model: "gpt-6-luna",
      input: [
        { role: "system", content: "You triage support tickets." },
        {
          role: "user",
          content: [
            { type: "input_text", text: "I was charged twice." },
            { type: "input_json", data: { order_id: 42 } },
          ],
        },
      ],
      questions: [
        { type: "predicate", instructions: "The user reports a problem." },
      ],
    });

    expect(decision.answers).toHaveLength(1);
    expect(decision.answers[0].type).toBe("predicate");
  });

  it("should reject a request without questions", async () => {
    const client = getTestClient();

    await expect(
      client.decisions.create({
        model: "gpt-6-luna",
        input: "Hello",
        questions: [],
      })
    ).rejects.toBeInstanceOf(BadRequestError);
  });

  it("should reject a choice question with duplicate values", async () => {
    const client = getTestClient();

    const error = await client.decisions
      .create({
        model: "gpt-6-luna",
        input: "Hello",
        questions: [
          {
            type: "choice",
            instructions: "Pick one.",
            choices: [{ value: "a" }, { value: "a" }],
          },
        ],
      })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(BadRequestError);
    expect((error as BadRequestError).param).toBe("questions[0].choices");
  });

  it("should keep string and boolean choice values distinct", async () => {
    const client = getTestClient();

    const decision = await client.decisions.create({
      model: "gpt-6-luna",
      input: "Hello",
      questions: [
        {
          type: "choice",
          instructions: "Pick one.",
          choices: [{ value: "true" }, { value: true }],
        },
      ],
    });

    expect(decision.answers[0].type).toBe("choice");
  });

  it("should wait responseDelayMs before returning", async () => {
    const baseUrl = getBaseUrl();
    const delayMs = 300;
    const configured = await fetch(`${baseUrl}/api/config/global`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ responseDelayMs: delayMs }),
    });
    expect(configured.ok).toBe(true);

    const started = Date.now();
    const client = getTestClient();
    await client.decisions.create({
      model: "gpt-6-luna",
      input: "Hello",
      questions: [{ type: "predicate", instructions: "Is this a greeting?" }],
    });
    expect(Date.now() - started).toBeGreaterThanOrEqual(delayMs - 40);

    const reset = await fetch(`${baseUrl}/api/config/global`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ responseDelayMs: 0 }),
    });
    expect(reset.ok).toBe(true);
  });
});
