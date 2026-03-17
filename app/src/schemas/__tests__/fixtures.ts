import type { AnthropicToolCall, OpenAIToolCall } from "../toolCallSchemas";
import {
  createAnthropicToolCall,
  createOpenAIToolCall,
} from "../toolCallSchemas";
import type {
  AnthropicToolDefinition,
  AwsToolDefinition,
  GeminiToolDefinition,
  OpenAIToolDefinition,
} from "../toolSchemas";

const defaultToolParams = {
  type: "object" as const,
  properties: { new_arg: { type: "string" as const } },
  required: [] as string[],
};

const testOpenAIToolDefinition: OpenAIToolDefinition = {
  type: "function",
  function: {
    name: "new_function_1",
    description: "a description",
    parameters: defaultToolParams,
  },
};

const testAnthropicToolDefinition: AnthropicToolDefinition = {
  name: "new_function_1",
  description: "a description",
  input_schema: defaultToolParams,
};

const testGeminiToolDefinition: GeminiToolDefinition = {
  name: "new_function_1",
  description: "a description",
  parameters: defaultToolParams,
};

const testAwsToolDefinition: AwsToolDefinition = {
  toolSpec: {
    name: "new_function_1",
    description: "a description",
    inputSchema: { json: defaultToolParams },
  },
};

export const getTestOpenAIToolDefinition = (
  config: Partial<OpenAIToolDefinition> = {}
): OpenAIToolDefinition =>
  Object.assign({ ...testOpenAIToolDefinition }, config);

export const getTestAnthropicToolDefinition = (
  config: Partial<AnthropicToolDefinition> = {}
): AnthropicToolDefinition =>
  Object.assign({ ...testAnthropicToolDefinition }, config);

export const getTestGeminiToolDefinition = (
  config: Partial<GeminiToolDefinition> = {}
): GeminiToolDefinition =>
  Object.assign({ ...testGeminiToolDefinition }, config);

export const getTestAwsToolDefinition = (
  config: Partial<AwsToolDefinition> = {}
): AwsToolDefinition => Object.assign({ ...testAwsToolDefinition }, config);

export const getTestOpenAIToolCall = (
  config: Partial<OpenAIToolCall> = {}
): OpenAIToolCall => Object.assign({ ...createOpenAIToolCall() }, config);

export const getTestAnthropicToolCall = (
  config: Partial<AnthropicToolCall> = {}
) => Object.assign({ ...createAnthropicToolCall() }, config);
