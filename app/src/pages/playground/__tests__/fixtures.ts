import {
  AnthropicToolDefinition,
  OpenAIToolDefinition,
} from "@phoenix/schemas";
import {
  AnthropicToolCall,
  OpenAIToolCall,
} from "@phoenix/schemas/toolCallSchemas";

import { PlaygroundSpan } from "../spanPlaygroundPageLoader";

export const basePlaygroundSpan: PlaygroundSpan = {
  __typename: "Span",
  id: "fake-span-global-id",
  spanId: "fake-span-id",
  trace: {
    id: "fake-trace-global-id",
    traceId: "fake-trace-id",
  },
  project: {
    id: "fake-project-global-id",
    name: "test",
  },
  attributes: "",
  // Implement a few default openai invocation parameters
  invocationParameters: [
    {
      __typename: "BoundedFloatInvocationParameter",
      canonicalName: "TOP_P",
      invocationInputField: "value_float",
      invocationName: "top_p",
    },
    {
      __typename: "IntInvocationParameter",
      canonicalName: "MAX_COMPLETION_TOKENS",
      invocationInputField: "value_int",
      invocationName: "max_tokens",
    },
    {
      __typename: "StringListInvocationParameter",
      canonicalName: "STOP_SEQUENCES",
      invocationInputField: "value_string_list",
      invocationName: "stop",
    },
    {
      __typename: "IntInvocationParameter",
      canonicalName: "RANDOM_SEED",
      invocationInputField: "value_int",
      invocationName: "seed",
    },
    {
      __typename: "JsonInvocationParameter",
      canonicalName: "RESPONSE_FORMAT",
      invocationInputField: "value_json",
      invocationName: "response_format",
    },
  ],
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

export type SpanToolCall = {
  tool_call: {
    id: string;
    function: {
      name: string;
      arguments: string;
    };
  };
};

export const testSpanToolCall: SpanToolCall = {
  tool_call: {
    id: "1",
    function: {
      name: "functionName",
      arguments: JSON.stringify({ arg1: "value1" }),
    },
  },
};

export const expectedUnknownToolCall = {
  id: "1",
  function: {
    name: "functionName",
    arguments: { arg1: "value1" },
  },
};

export const expectedTestOpenAIToolCall: OpenAIToolCall = {
  id: "1",
  type: "function",
  function: {
    name: "functionName",
    arguments: { arg1: "value1" },
  },
};

export const expectedAnthropicToolCall: AnthropicToolCall = {
  id: "1",
  type: "tool_use",
  name: "functionName",
  input: { arg1: "value1" },
};

export type SpanTool = {
  tool: {
    json_schema: string;
  };
};

export const testSpanOpenAIToolJsonSchema: OpenAIToolDefinition = {
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

export const testSpanOpenAITool: SpanTool = {
  tool: {
    json_schema: JSON.stringify(testSpanOpenAIToolJsonSchema),
  },
};

export const testSpanAnthropicToolDefinition: AnthropicToolDefinition = {
  name: "get_weather",
  description: "This is a test tool",
  input_schema: {
    type: "object",
    properties: {
      city: {
        type: "string",
      },
    },
  },
};

export const testSpanAnthropicTool: SpanTool = {
  tool: {
    json_schema: JSON.stringify(testSpanAnthropicToolDefinition),
  },
};
