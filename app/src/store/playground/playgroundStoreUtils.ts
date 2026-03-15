import { fromOpenAIToolCall, toOpenAIToolCall } from "@phoenix/schemas";
import { assertUnreachable } from "@phoenix/typeUtils";

import type { ChatMessage } from "./types";

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
      case "CEREBRAS":
      case "FIREWORKS":
      case "GROQ":
      case "MOONSHOT":
      case "PERPLEXITY":
      case "TOGETHER":
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
