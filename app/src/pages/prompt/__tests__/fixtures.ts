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
  tools: null,
  responseFormat: null,
} satisfies FixturePromptVersion;

export const TOOL_FUNCTION = {
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
  strict: null,
};

export const TOOLS_FIXTURE = {
  tools: [{ function: TOOL_FUNCTION }],
  toolChoice: null,
  disableParallelToolCalls: null,
} satisfies NonNullable<FixturePromptVersion["tools"]>;

export const RESPONSE_FORMAT_FIXTURE = {
  jsonSchema: {
    name: "test_format",
    description: "test format",
    schema: {
      type: "object",
      properties: {
        format: { type: "string" },
      },
    },
    strict: null,
  },
} satisfies NonNullable<FixturePromptVersion["responseFormat"]>;

// Legacy raw provider-specific formats (kept for reference, not used as fixture data)
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
