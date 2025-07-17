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
        role: "user",
        content: [{ type: "text", text: "Hello" }],
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
    tool_choice: { type: "zero_or_more" },
    tools: [
      {
        type: "function",
        function: {
          name: "test",
          description: "test function",
          parameters: {
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
    type: "json_schema",
    json_schema: {
      name: "test",
      description: "test function",
      schema: {
        type: "object",
        properties: {},
      },
    },
  },
} satisfies Partial<PromptVersion>;
