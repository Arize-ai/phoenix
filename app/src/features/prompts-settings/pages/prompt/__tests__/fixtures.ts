import type { PromptCodeExportCard__main$data as PromptVersion } from "../__generated__/PromptCodeExportCard__main.graphql";

export type FixturePromptVersion = Omit<PromptVersion, " $fragmentType">;

export const BASE_MOCK_PROMPT_VERSION = {
  id: "fake-version-id",
  modelProvider: "OPENAI",
  modelName: "gpt-4",
  templateType: "CHAT",
  templateFormat: "MUSTACHE",
  template: {
    __typename: "PromptChatTemplate",
    messages: [
      {
        role: "USER",
        content: [{ __typename: "TextContentPart", text: { text: "Hello" } }],
      },
    ],
  },
  invocationParameters: {
    temperature: 0.7,
  },
  tools: [],
  responseFormat: null,
} satisfies FixturePromptVersion;

export const OPENAI_TOOL = {
  type: "function",
  function: {
    name: "test",
    description: "test function",
    parameters: {
      type: "object",
      properties: {
        foo: {
          type: "string",
        },
      },
      required: ["foo"],
    },
  },
};

export const ANTHROPIC_TOOL = {
  name: "test",
  description: "test function",
  input: {
    type: "object",
    properties: {
      foo: { type: "string" },
    },
  },
};

export const OPENAI_RESPONSE_FORMAT = {
  type: "json_schema",
  json_schema: {
    name: "test_format",
    description: "test format",
    schema: {
      type: "object",
      properties: {
        format: { type: "string" },
      },
    },
  },
};
