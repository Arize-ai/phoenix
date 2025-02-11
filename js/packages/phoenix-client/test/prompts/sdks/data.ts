import { PromptVersion } from "../../../src/types/prompts";

export const BASE_MOCK_PROMPT_VERSION = {
  id: "test",
  description: "Test prompt",
  model_provider: "OPENAI",
  model_name: "gpt-4",
  template_type: "CHAT",
  template_format: "MUSTACHE",
  template: {
    type: "chat",
    messages: [
      {
        role: "USER",
        content: [{ type: "text", text: { text: "Hello" } }],
      },
    ],
  },
  invocation_parameters: {
    type: "openai",
    openai: {
      temperature: 0.7,
    },
  },
} satisfies Partial<PromptVersion>;

export const BASE_MOCK_PROMPT_VERSION_TOOLS = {
  tools: {
    type: "tools",
    tool_choice: { type: "zero-or-more" },
    tools: [
      {
        type: "function-tool",
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
    type: "response-format-json-schema",
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
