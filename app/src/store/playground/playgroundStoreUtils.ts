import {
  fromOpenAIToolCall,
  fromOpenAIToolDefinition,
  toOpenAIToolCall,
  toOpenAIToolDefinition,
} from "@phoenix/schemas";
import { assertUnreachable } from "@phoenix/typeUtils";

import { ChatMessage, Tool } from "./types";

/**
 * Best effort attempts to convert instance tools to the providers schema
 * If the tool definition cannot be converted, it will be returned as is
 * @returns A list of playground {@link Tool|Tools}
 */
export const convertInstanceToolsToProvider = ({
  instanceTools,
  provider,
}: {
  instanceTools: Tool[];
  provider: ModelProvider;
}): Tool[] => {
  return instanceTools.map((tool) => {
    switch (provider) {
      case "OPENAI":
      case "DEEPSEEK":
      case "XAI":
      case "OLLAMA":
      case "AZURE_OPENAI": {
        const maybeOpenAIToolDefinition = toOpenAIToolDefinition(
          tool.definition
        );
        return {
          ...tool,
          definition: maybeOpenAIToolDefinition ?? tool.definition,
        };
      }
      case "ANTHROPIC": {
        const maybeOpenAIToolDefinition = toOpenAIToolDefinition(
          tool.definition
        );
        const definition = maybeOpenAIToolDefinition
          ? fromOpenAIToolDefinition({
              toolDefinition: maybeOpenAIToolDefinition,
              targetProvider: provider,
            })
          : tool.definition;
        return {
          ...tool,
          definition,
        };
      }
      case "AWS": {
        // Keep AWS tool definitions in OpenAI format
        // The backend will handle the conversion to AWS format
        const maybeOpenAIToolDefinition = toOpenAIToolDefinition(
          tool.definition
        );

        const definition = maybeOpenAIToolDefinition
          ? fromOpenAIToolDefinition({
              toolDefinition: maybeOpenAIToolDefinition,
              targetProvider: provider,
            })
          : tool.definition;
        return {
          ...tool,
          definition,
        };
      }
      case "GOOGLE": {
        const maybeOpenAIToolDefinition = toOpenAIToolDefinition(
          tool.definition
        );
        const definition = maybeOpenAIToolDefinition
          ? fromOpenAIToolDefinition({
              toolDefinition: maybeOpenAIToolDefinition,
              targetProvider: provider,
            })
          : tool.definition;
        return {
          ...tool,
          definition,
        };
      }
      default:
        assertUnreachable(provider);
    }
  });
};

/**
 * Best effort attempts to convert message tool calls to the providers schema
 * If the tool definition cannot be converted, it will be returned as is
 * @returns A list of {@link ChatMessage} tool calls
 */
export const convertMessageToolCallsToProvider = ({
  toolCalls,
  provider,
}: {
  toolCalls: ChatMessage["toolCalls"];
  provider: ModelProvider;
}): ChatMessage["toolCalls"] => {
  if (toolCalls == null) {
    return;
  }
  return toolCalls.map((toolCall) => {
    switch (provider) {
      case "OPENAI":
      case "DEEPSEEK":
      case "XAI":
      case "OLLAMA":
      case "AZURE_OPENAI": {
        return toOpenAIToolCall(toolCall) ?? toolCall;
      }
      case "ANTHROPIC": {
        const maybeOpenAIToolCall = toOpenAIToolCall(toolCall);
        return maybeOpenAIToolCall != null
          ? fromOpenAIToolCall({
              toolCall: maybeOpenAIToolCall,
              targetProvider: provider,
            })
          : toolCall;
      }
      case "AWS": {
        const maybeAwsToolCall = toOpenAIToolCall(toolCall);
        return maybeAwsToolCall != null
          ? fromOpenAIToolCall({
              toolCall: maybeAwsToolCall,
              targetProvider: provider,
            })
          : toolCall;
      }
      // TODO(apowell): #5348 Add Google tool call
      case "GOOGLE":
        return toolCall;
      default:
        assertUnreachable(provider);
    }
  });
};
