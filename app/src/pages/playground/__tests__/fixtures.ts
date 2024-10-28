import { PlaygroundSpan } from "../spanPlaygroundPageLoader";

export const basePlaygroundSpan: PlaygroundSpan = {
  __typename: "Span",
  id: "fake-id",
  context: {
    traceId: "test",
    spanId: "test",
  },
  project: {
    id: "test",
    name: "test",
  },
  attributes: "",
};
export const spanAttributesWithInputMessages = {
  llm: {
    output_messages: [
      {
        message: {
          content: "This is an AI Answer",
          role: "assistant",
        },
      },
    ],
    model_name: "gpt-3.5-turbo",
    token_count: { completion: 9.0, prompt: 1881.0, total: 1890.0 },
    input_messages: [
      {
        message: {
          content: "You are a chatbot",
          role: "system",
        },
      },
      {
        message: {
          content: "hello?",
          role: "user",
        },
      },
    ],
    invocation_parameters:
      '{"context_window": 16384, "num_output": -1, "is_chat_model": true, "is_function_calling_model": true, "model_name": "gpt-3.5-turbo"}',
  },
  openinference: { span: { kind: "LLM" } },
} as const;

export const testSpanToolCall = {
  tool_call: {
    id: "1",
    function: {
      name: "functionName",
      arguments: JSON.stringify({ arg1: "value1" }),
    },
  },
};

export const expectedTestToolCall = {
  id: "1",
  function: {
    name: "functionName",
    arguments: JSON.stringify({ arg1: "value1" }),
  },
};

export const testSpanToolJsonSchema = {
  type: "function",
  function: {
    name: "get_weather",
    parameters: {
      type: "object",
      properties: {
        city: { type: "string" },
      },
    },
  },
};

export const testSpanTool = {
  tool: {
    json_schema: JSON.stringify(testSpanToolJsonSchema),
  },
};
