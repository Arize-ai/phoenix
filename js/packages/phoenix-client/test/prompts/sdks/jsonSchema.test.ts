import { describe, expect, it } from "vitest";

import { toSDK } from "../../../src/prompts/sdks/toSDK";
import { jsonSchemaZodSchema } from "../../../src/schemas/jsonSchema";
import type { PromptVersion } from "../../../src/types/prompts";
import { BASE_MOCK_PROMPT_VERSION } from "./data";

const schema = {
  type: "object",
  properties: {
    timezone: {
      anyOf: [{ type: "string" }, { type: "null" }],
      description: "The timezone for the booking",
      default: "UTC",
      maxLength: 8,
    },
    location: {
      type: "string",
      description: "The location for the booking",
      default: "home",
      maxLength: 8,
    },
  },
  required: ["timezone", "location"],
  additionalProperties: false,
};

const enumSchema = {
  type: "object",
  properties: {
    location: { type: "string", enum: ["home", "office"] },
    duration: { type: "integer", enum: [0, 30, 60] },
    priority: { type: "number", enum: [0, 0.5, 1] },
    recurring: { type: "boolean", enum: [false] },
    reminder: {
      anyOf: [
        { type: "integer", enum: [5, 10] },
        { type: "null", enum: [null] },
      ],
    },
    days: { type: "array", enum: [["Monday"], ["Tuesday", "Thursday"]] },
    room: {
      type: "object",
      enum: [
        { floor: 1, name: "A" },
        { floor: 2, name: "B" },
      ],
    },
  },
};

const objectEnumSchema = {
  type: "object",
  properties: {
    value: {
      type: "object",
      enum: [
        JSON.parse('{"__proto__":{"kind":"data"},"value":0}'),
        { nested: [JSON.parse('{"__proto__":null,"value":false}')] },
      ],
    },
  },
  required: ["value"],
  additionalProperties: false,
};

describe.each([
  { name: "anyOf fields", schema },
  { name: "enum values", schema: enumSchema },
  { name: "own __proto__ keys in enum values", schema: objectEnumSchema },
])("JSON schema conversion preserves $name", ({ schema }) => {
  const tool = {
    type: "function" as const,
    function: {
      name: "book",
      description: "Book a meeting",
      parameters: schema,
    },
  };

  const prompt = {
    ...BASE_MOCK_PROMPT_VERSION,
    tools: { type: "tools", tools: [tool] },
  } satisfies PromptVersion;

  it.each([
    { sdk: "openai" as const, tools: [tool] },
    {
      sdk: "anthropic" as const,
      tools: [
        {
          name: "book",
          description: "Book a meeting",
          input_schema: schema,
        },
      ],
    },
    {
      sdk: "ai" as const,
      tools: {
        book: {
          type: "function",
          description: "Book a meeting",
          inputSchema: {
            _type: undefined,
            jsonSchema: schema,
            validate: undefined,
          },
        },
      },
    },
  ])("in $sdk tools", ({ sdk, tools }) => {
    const result = toSDK({ sdk, prompt });

    expect(result?.tools).toStrictEqual(tools);
  });

  it("in OpenAI response formats", () => {
    const responseFormat = {
      type: "json_schema" as const,
      json_schema: { name: "booking", description: "Book a meeting", schema },
    };
    const result = toSDK({
      sdk: "openai",
      prompt: {
        ...BASE_MOCK_PROMPT_VERSION,
        response_format: responseFormat,
      },
    });

    expect(result?.response_format).toStrictEqual(responseFormat);
  });
});

it.each([
  undefined,
  NaN,
  Infinity,
  BigInt(1),
  () => "value",
  Symbol("value"),
  { value: undefined },
  { ["__proto__"]: undefined },
  { nested: [{ ["__proto__"]: { value: undefined } }] },
])("rejects non-JSON enum values: %s", (value) => {
  const result = jsonSchemaZodSchema.safeParse({
    type: "object",
    properties: { value: { type: "object", enum: [value] } },
  });

  expect(result.success).toBe(false);
});
