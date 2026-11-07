import { describe, expect, it } from "vitest";

import { toSDK } from "../../../src/prompts/sdks/toSDK";
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

describe("JSON schema conversion", () => {
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
          description: "Book a meeting",
          inputSchema: { jsonSchema: schema },
        },
      },
    },
  ])("preserves anyOf fields in $sdk tools", ({ sdk, tools }) => {
    const result = toSDK({ sdk, prompt });

    expect(result?.tools).toMatchObject(tools);
  });

  it("preserves anyOf fields in OpenAI response formats", () => {
    const responseFormat = {
      type: "json_schema" as const,
      json_schema: { name: "booking", schema },
    };
    const result = toSDK({
      sdk: "openai",
      prompt: { ...prompt, response_format: responseFormat },
    });

    expect(result?.response_format).toEqual(responseFormat);
  });
});
