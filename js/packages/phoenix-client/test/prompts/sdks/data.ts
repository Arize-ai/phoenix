import { PromptVersion } from "../../../src/types/prompts";

export const BASE_MOCK_PROMPT_VERSION = {
  id: "test",
  description: "Test prompt",
  model_provider: "openai",
  model_name: "gpt-4",
  template_type: "CHAT",
  template_format: "MUSTACHE",
  template: {
    version: "chat-template-v1",
    messages: [
      {
        role: "USER",
        content: [{ type: "text", text: { text: "Hello" } }],
      },
    ],
  },
  invocation_parameters: {
    temperature: 0.7,
  },
} satisfies Partial<PromptVersion>;

export const BASE_MOCK_PROMPT_VERSION_TOOLS = {
  tools: {
    type: "tools-v1",
    tool_choice: { type: "zero-or-more" },
    tools: [
      {
        type: "function-tool-v1",
        name: "test",
        description: "test function",
        schema: {
          type: "json-schema-draft-7-object-schema",
          json: {
            type: "object",
            properties: {},
          },
        },
      },
    ],
  },
} satisfies Partial<PromptVersion>;

export const BASE_MOCK_PROMPT_VERSION_RESPONSE_FORMAT = {
  response_format: {
    type: "response-format-json-schema-v1",
    name: "test",
    description: "test function",
    schema: {
      type: "json-schema-draft-7-object-schema",
      json: {
        type: "object",
        properties: {},
      },
    },
    extra_parameters: {},
  },
} satisfies Partial<PromptVersion>;
