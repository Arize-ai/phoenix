import type { AnthropicToolCall, OpenAIToolCall } from "../toolCallSchemas";
import {
  createAnthropicToolCall,
  createOpenAIToolCall,
} from "../toolCallSchemas";
import type {
  AnthropicToolDefinition,
  OpenAIToolDefinition,
} from "../toolSchemas";
import {
  createAnthropicToolDefinition,
  createOpenAIToolDefinition,
} from "../toolSchemas";

export const getTestAnthropicToolDefinition = (
  config: Partial<AnthropicToolDefinition> = {}
): AnthropicToolDefinition =>
  Object.assign(
    {
      ...createAnthropicToolDefinition(1),
    },
    config
  );

export const getTestOpenAIToolDefinition = (
  config: Partial<OpenAIToolDefinition> = {}
): OpenAIToolDefinition =>
  Object.assign({ ...createOpenAIToolDefinition(1) }, config);

export const getTestOpenAIToolCall = (
  config: Partial<OpenAIToolCall> = {}
): OpenAIToolCall => Object.assign({ ...createOpenAIToolCall() }, config);

export const getTestAnthropicToolCall = (
  config: Partial<AnthropicToolCall> = {}
) => Object.assign({ ...createAnthropicToolCall() }, config);
