import {
  BadRequestError,
  TypeSafeClient,
  box,
  choice,
  noul,
  score,
} from "@typesafe-ai/sdk";
import { describe, it, expect, beforeAll, afterAll } from "vitest";

import { startServer, stopServer, getBaseUrl } from "./setup";

function getTypeSafeClient(): TypeSafeClient {
  // The TypeSafe SDK adds /v1 to the base URL
  return new TypeSafeClient({
    baseURL: getBaseUrl(),
    apiKey: "test-key",
    retry: { maxRetries: 0 },
    logLevel: "off",
  });
}

describe("TypeSafe System One API", () => {
  beforeAll(async () => {
    await startServer();
  });

  afterAll(async () => {
    await stopServer();
  });

  it("should answer noul, choice, and score questions by name", async () => {
    const client = getTypeSafeClient();

    const result = await client.systemOne({
      model: "jev-latest",
      state: "I was charged twice. Please help.",
      questions: {
        billing: noul("Is this about billing?"),
        team: choice("Which department should handle the ticket?", {
          billing: "Charges and payments.",
          technical: "Product faults.",
          other: null,
        }),
        urgency: score("How urgent is the ticket?", [
          "Not urgent",
          "Somewhat urgent",
          "Very urgent",
        ]),
      },
    });

    expect(result.model).toBe("jev-latest");
    expect(Object.keys(result.answers).sort()).toEqual([
      "billing",
      "team",
      "urgency",
    ]);

    const { billing, team, urgency } = result.answers;

    expect(billing.type).toBe("noul");
    expect(billing.noul).toBeGreaterThanOrEqual(0);
    expect(billing.noul).toBeLessThanOrEqual(1);

    expect(team.type).toBe("choice");
    expect(["billing", "technical", "other"]).toContain(team.choice);
    expect(Object.keys(team.probabilities).sort()).toEqual([
      "billing",
      "other",
      "technical",
    ]);
    const choiceTotal = Object.values(team.probabilities).reduce(
      (s: number, p: number) => s + p,
      0
    );
    expect(choiceTotal).toBeCloseTo(1, 6);
    expect(team.probabilities[team.choice]).toBe(team.confidence);

    expect(urgency.type).toBe("score");
    expect(urgency.legend).toEqual({
      "0": "Not urgent",
      "1": "Somewhat urgent",
      "2": "Very urgent",
    });
    const expected = Object.entries(urgency.probabilities).reduce(
      (sum, [level, probability]) => sum + Number(level) * probability,
      0
    );
    expect(urgency.score).toBeCloseTo(expected, 6);

    expect(result.usage.input_tokens).toBeGreaterThan(0);
    expect(result.usage.output_tokens).toBe(3);
  });

  it("should answer a box question with ordered edges", async () => {
    const client = getTypeSafeClient();

    const result = await client.systemOne({
      model: "jev-preview",
      state: { description: "A photo of a dog in a park" },
      questions: { dog: box("The dog") },
    });

    const { top, bottom, left, right } = result.answers.dog.box;
    expect(top).toBeLessThanOrEqual(bottom);
    expect(left).toBeLessThanOrEqual(right);
  });

  it("should decode zstd-compressed request bodies", async () => {
    // The SDK compresses bodies of 1 KiB or more with zstd by default
    const client = getTypeSafeClient();
    expect(client.compression).toBe("zstd");

    const result = await client.systemOne({
      model: "jev-latest",
      state: "I was charged twice. ".repeat(200),
      questions: { billing: noul("Is this about billing?") },
    });

    expect(result.answers.billing.type).toBe("noul");
  });

  it("should list models", async () => {
    const client = getTypeSafeClient();

    const models = await client.models.list();

    expect(models.map((m) => m.name)).toContain("jev-latest");
  });

  it("should reject an unknown question type", async () => {
    const response = await fetch(`${getBaseUrl()}/v1/systemone`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer test-key",
      },
      body: JSON.stringify({
        model: "jev-latest",
        state: "Hello",
        questions: { q: { type: "rank" } },
      }),
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.detail).toContain("questions.q.type");
  });

  it("should surface server validation errors through the SDK", async () => {
    // Route the SDK's well-formed request through a fetch that strips `state`,
    // since the SDK rejects a missing state before sending
    const client = new TypeSafeClient({
      baseURL: getBaseUrl(),
      apiKey: "test-key",
      retry: { maxRetries: 0 },
      logLevel: "off",
      compression: false,
      fetch: (input, init) => {
        const body = JSON.parse(String(init?.body));
        delete body.state;
        return fetch(input, { ...init, body: JSON.stringify(body) });
      },
    });

    await expect(
      client.systemOne({
        model: "jev-latest",
        state: "Hello",
        questions: { billing: noul("Is this about billing?") },
      })
    ).rejects.toBeInstanceOf(BadRequestError);
  });
});
