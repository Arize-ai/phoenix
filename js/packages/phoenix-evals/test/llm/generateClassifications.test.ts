import { MockLanguageModelV3 } from "ai/test";
import { describe, expect, it } from "vitest";

import { generateClassifications } from "../../src/llm/generateClassifications";
import type { ClassificationCriterion } from "../../src/types/evals";

const CRITERIA: [ClassificationCriterion, ...ClassificationCriterion[]] = [
  {
    name: "sentiment",
    labels: { positive: null, negative: null },
    instruction: "Is the sentiment positive or negative?",
  },
  {
    name: "toxicity",
    labels: { toxic: null, non_toxic: null },
    instruction: "Is the text toxic?",
  },
];

/**
 * A language model whose `doGenerate` answers every criterion at once with the
 * given labels, and counts how many times it was called.
 */
function createMockModel(labelByCriterion: Record<string, string>) {
  const state = { generateCalls: 0, lastResponseFormat: undefined as unknown };
  const model = new MockLanguageModelV3({
    doGenerate: async (options) => {
      state.generateCalls += 1;
      state.lastResponseFormat = options.responseFormat;
      const object = Object.fromEntries(
        Object.entries(labelByCriterion).map(([name, label]) => [
          name,
          { label, explanation: `because ${label}` },
        ])
      );
      return {
        finishReason: { unified: "stop", raw: undefined },
        usage: {
          inputTokens: { total: 10, noCache: 10 },
          outputTokens: { total: 10, text: 10 },
        },
        content: [{ type: "text", text: JSON.stringify(object) }],
        warnings: [],
      };
    },
  });
  return { model, state };
}

describe("generateClassifications", () => {
  it("answers all criteria in a single model call, one result per criterion", async () => {
    const { model, state } = createMockModel({
      sentiment: "positive",
      toxicity: "non_toxic",
    });

    const results = await generateClassifications({
      model,
      criteria: CRITERIA,
      prompt: "Classify this text.",
      telemetry: { isEnabled: false },
    });

    expect(state.generateCalls).toBe(1);
    expect(results).toEqual([
      {
        name: "sentiment",
        label: "positive",
        explanation: "because positive",
      },
      {
        name: "toxicity",
        label: "non_toxic",
        explanation: "because non_toxic",
      },
    ]);
  });

  it("builds one schema property per criterion keyed by its name", async () => {
    const { model, state } = createMockModel({
      sentiment: "negative",
      toxicity: "toxic",
    });

    await generateClassifications({
      model,
      criteria: CRITERIA,
      prompt: "Classify this text.",
      telemetry: { isEnabled: false },
    });

    const responseFormat = state.lastResponseFormat as {
      type: string;
      schema: { properties: Record<string, unknown>; required: string[] };
    };
    expect(responseFormat.type).toBe("json");
    expect(Object.keys(responseFormat.schema.properties)).toEqual([
      "sentiment",
      "toxicity",
    ]);
    expect(responseFormat.schema.required).toEqual(["sentiment", "toxicity"]);
  });

  it("types the label as a free-form string and lists plain labels in its description", async () => {
    const { model, state } = createMockModel({
      sentiment: "positive",
      toxicity: "non_toxic",
    });

    await generateClassifications({
      model,
      criteria: CRITERIA,
      prompt: "Classify this text.",
      telemetry: { isEnabled: false },
    });

    const label = labelSchemaOf(state.lastResponseFormat, "sentiment");
    expect(label.type).toBe("string");
    expect(label.enum ?? label.anyOf ?? label.oneOf).toBeUndefined();
    expect(label.description).toContain('"positive"');
    expect(label.description).toContain('"negative"');
  });

  it("includes each label's description in the label field when descriptions are given", async () => {
    const described: [ClassificationCriterion, ...ClassificationCriterion[]] = [
      {
        name: "sentiment",
        instruction: "Classify the sentiment.",
        labels: { positive: "clearly positive", negative: "clearly negative" },
      },
    ];
    const { model, state } = createMockModel({ sentiment: "positive" });

    await generateClassifications({
      model,
      criteria: described,
      prompt: "Classify this text.",
      telemetry: { isEnabled: false },
    });

    const label = labelSchemaOf(state.lastResponseFormat, "sentiment");
    expect(label.type).toBe("string");
    expect(label.description).toContain('"positive": clearly positive');
    expect(label.description).toContain('"negative": clearly negative');
  });
});

interface LabelSchema {
  type?: string;
  description?: string;
  enum?: string[];
  anyOf?: unknown[];
  oneOf?: unknown[];
}

interface ObjectSchema {
  properties?: Record<string, LabelSchema>;
  anyOf?: ObjectSchema[];
}

/**
 * Pull one criterion's `label` sub-schema out of a captured JSON
 * responseFormat, unwrapping the nullable wrapper when present (a nullable
 * property becomes `{ anyOf: [ <object>, { type: "null" } ] }`).
 */
function labelSchemaOf(responseFormat: unknown, name: string): LabelSchema {
  const format = responseFormat as {
    schema: { properties: Record<string, ObjectSchema> };
  };
  const property = format.schema.properties[name]!;
  const objectSchema = property.properties
    ? property
    : (property.anyOf?.find((variant) => variant.properties) ?? property);
  return objectSchema.properties!.label!;
}
