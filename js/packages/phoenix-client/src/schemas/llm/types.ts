import type { OpenAIChatPart } from "./openai/messagePartSchemas";
import type { AnthropicMessagePart } from "./anthropic/messagePartSchemas";
import type { PhoenixPromptPart } from "./phoenixPrompt";
import type { VercelAIChatPart } from "./ai";
import { PromptModelProvider } from "../../types/prompts";
import { OpenAIMessage } from "./openai/messageSchemas";
import { AnthropicMessage } from "./anthropic/messageSchemas";
import { JSONLiteral } from "../jsonLiteralSchema";
import { OpenAIToolCall } from "./openai/toolCallSchemas";
import { AnthropicToolCall } from "./anthropic/toolCallSchemas";
import { OpenaiToolChoice } from "./openai/toolChoiceSchemas";
import { AnthropicToolChoice } from "./anthropic/toolChoiceSchemas";

export type LLMMessagePart =
  | OpenAIChatPart
  | AnthropicMessagePart
  | PhoenixPromptPart
  | VercelAIChatPart;

export type MessagePartProvider = PromptModelProvider | "UNKNOWN";

/**
 * @todo We need to distinguish between provider and sdk types
 */
export type MessagePartWithProvider =
  | {
      provider: Extract<PromptModelProvider, "OPENAI" | "AZURE_OPENAI">;
      validatedMessage: OpenAIChatPart;
    }
  | {
      provider: Extract<PromptModelProvider, "ANTHROPIC">;
      validatedMessage: AnthropicMessagePart;
    }
  | { provider: "UNKNOWN"; validatedMessage: null };

export type MessageProvider = PromptModelProvider | "UNKNOWN";

export type MessageWithProvider =
  | {
      provider: Extract<PromptModelProvider, "OPENAI" | "AZURE_OPENAI">;
      validatedMessage: OpenAIMessage;
    }
  | {
      provider: Extract<PromptModelProvider, "ANTHROPIC">;
      validatedMessage: AnthropicMessage;
    }
  | {
      provider: Extract<PromptModelProvider, "GEMINI">;
      validatedMessage: JSONLiteral;
    }
  | { provider: "UNKNOWN"; validatedMessage: null };

export type ProviderToMessageMap = {
  OPENAI: OpenAIMessage;
  AZURE_OPENAI: OpenAIMessage;
  ANTHROPIC: AnthropicMessage;
  // Use generic JSON type for unknown message formats / new providers
  GEMINI: JSONLiteral;
};

export type ToolCallWithProvider =
  | {
      provider: Extract<PromptModelProvider, "OPENAI" | "AZURE_OPENAI">;
      validatedToolCall: OpenAIToolCall;
    }
  | {
      provider: Extract<PromptModelProvider, "ANTHROPIC">;
      validatedToolCall: AnthropicToolCall;
    }
  | { provider: "UNKNOWN"; validatedToolCall: null };

export type ProviderToToolCallMap = {
  OPENAI: OpenAIToolCall;
  AZURE_OPENAI: OpenAIToolCall;
  ANTHROPIC: AnthropicToolCall;
  // Use generic JSON type for unknown tool formats / new providers
  GEMINI: JSONLiteral;
};

export type ToolChoiceWithProvider =
  | {
      provider: "OPENAI";
      toolChoice: OpenaiToolChoice;
    }
  | { provider: "AZURE_OPENAI"; toolChoice: OpenaiToolChoice }
  | { provider: "ANTHROPIC"; toolChoice: AnthropicToolChoice }
  | { provider: null; toolChoice: null };

export type ProviderToToolChoiceMap = {
  OPENAI: OpenaiToolChoice;
  AZURE_OPENAI: OpenaiToolChoice;
  ANTHROPIC: AnthropicToolChoice;
  // TODO(apowell): #5348 Add Gemini tool choice schema
  GEMINI: OpenaiToolChoice;
};
