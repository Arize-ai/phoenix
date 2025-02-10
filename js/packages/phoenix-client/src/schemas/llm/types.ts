import { ZodType, ZodTypeAny, ZodTypeDef } from "zod";

import type { OpenAIChatPart } from "./openai/messagePartSchemas";
import type { AnthropicMessagePart } from "./anthropic/messagePartSchemas";
import type {
  VercelAIChatPart,
  VercelAIChatPartToolCall,
} from "./ai/messagePartSchemas";
import type { PhoenixPromptPart } from "./phoenixPrompt/messagePartSchemas";
import { PromptProviderSDKs, PromptToolChoice } from "../../types/prompts";
import { OpenAIMessage } from "./openai/messageSchemas";
import { AnthropicMessage } from "./anthropic/messageSchemas";
import { OpenAIToolCall } from "./openai/toolCallSchemas";
import { AnthropicToolCall } from "./anthropic/toolCallSchemas";
import { OpenaiToolChoice } from "./openai/toolChoiceSchemas";
import { AnthropicToolChoice } from "./anthropic/toolChoiceSchemas";
import { VercelAIMessage } from "./ai/messageSchemas";
import { PromptToolCall } from "./phoenixPrompt/toolCallSchemas";
import { PromptMessage } from "./phoenixPrompt/messageSchemas";
import { VercelAIToolChoice } from "./ai/toolChoiceSchemas";
import { OpenAIToolDefinition } from "./openai/toolSchemas";
import { OpenAIResponseFormat } from "./openai/responseFormatSchema";
import { AnthropicToolDefinition } from "./anthropic/toolSchemas";
import { PhoenixPromptToolDefinition } from "./phoenixPrompt/toolSchemas";

export type PromptSDKFormat = PromptProviderSDKs | null;

export type LLMMessagePart =
  | OpenAIChatPart
  | AnthropicMessagePart
  | PhoenixPromptPart
  | VercelAIChatPart;

export type SDKConverters<
  Messages extends ZodTypeAny = never,
  MessageParts extends ZodTypeAny = never,
  ToolChoices extends ZodTypeAny = never,
  ToolCalls extends ZodTypeAny = never,
  ToolDefinitions extends ZodTypeAny = never,
  ResponseFormat extends ZodTypeAny = never,
> = {
  messages: {
    toOpenAI: ZodType<OpenAIMessage | null, ZodTypeDef, unknown>;
    fromOpenAI: Messages;
  };
  messageParts: {
    toOpenAI: ZodType<OpenAIChatPart | null, ZodTypeDef, unknown>;
    fromOpenAI: MessageParts;
  };
  toolChoices: {
    toOpenAI: ZodType<OpenaiToolChoice | null, ZodTypeDef, unknown>;
    fromOpenAI: ToolChoices;
  };
  toolCalls: {
    toOpenAI: ZodType<OpenAIToolCall | null, ZodTypeDef, unknown>;
    fromOpenAI: ToolCalls;
  };
  toolDefinitions: {
    toOpenAI: ZodType<OpenAIToolDefinition | null, ZodTypeDef, unknown>;
    fromOpenAI: ToolDefinitions;
  };
  responseFormat?: {
    toOpenAI: ZodType<OpenAIResponseFormat | null, ZodTypeDef, unknown>;
    fromOpenAI: ResponseFormat;
  };
};

export type MessagePartWithProvider =
  | {
      provider: Extract<PromptSDKFormat, "OPENAI" | "AZURE_OPENAI">;
      validatedMessage: OpenAIChatPart;
    }
  | {
      provider: Extract<PromptSDKFormat, "ANTHROPIC">;
      validatedMessage: AnthropicMessagePart;
    }
  | {
      provider: Extract<PromptSDKFormat, "PHOENIX_PROMPT">;
      validatedMessage: PhoenixPromptPart;
    }
  | {
      provider: Extract<PromptSDKFormat, "VERCEL_AI">;
      validatedMessage: VercelAIChatPart;
    }
  | { provider: null; validatedMessage: null };

export type MessageWithProvider =
  | {
      provider: Extract<PromptSDKFormat, "OPENAI" | "AZURE_OPENAI">;
      validatedMessage: OpenAIMessage;
    }
  | {
      provider: Extract<PromptSDKFormat, "ANTHROPIC">;
      validatedMessage: AnthropicMessage;
    }
  | {
      provider: Extract<PromptSDKFormat, "PHOENIX_PROMPT">;
      validatedMessage: PromptMessage;
    }
  | {
      provider: Extract<PromptSDKFormat, "VERCEL_AI">;
      validatedMessage: VercelAIMessage;
    }
  | { provider: null; validatedMessage: null };

export type ToolDefinitionWithProvider =
  | {
      provider: Extract<PromptSDKFormat, "OPENAI" | "AZURE_OPENAI">;
      validatedToolDefinition: OpenAIToolDefinition;
    }
  | {
      provider: Extract<PromptSDKFormat, "ANTHROPIC">;
      validatedToolDefinition: AnthropicToolDefinition;
    }
  | {
      provider: Extract<PromptSDKFormat, "PHOENIX_PROMPT">;
      validatedToolDefinition: PhoenixPromptToolDefinition;
    }
  | {
      provider: Extract<PromptSDKFormat, "VERCEL_AI">;
      validatedToolDefinition: null;
    }
  | { provider: null; validatedToolDefinition: null };

export type ToolCallWithProvider =
  | {
      provider: Extract<PromptSDKFormat, "OPENAI" | "AZURE_OPENAI">;
      validatedToolCall: OpenAIToolCall;
    }
  | {
      provider: Extract<PromptSDKFormat, "ANTHROPIC">;
      validatedToolCall: AnthropicToolCall;
    }
  | {
      provider: Extract<PromptSDKFormat, "PHOENIX_PROMPT">;
      validatedToolCall: PromptToolCall;
    }
  | {
      provider: Extract<PromptSDKFormat, "VERCEL_AI">;
      validatedToolCall: VercelAIChatPartToolCall;
    }
  | { provider: null; validatedToolCall: null };

export type ToolChoiceWithProvider =
  | {
      provider: Extract<PromptSDKFormat, "OPENAI" | "AZURE_OPENAI">;
      toolChoice: OpenaiToolChoice;
    }
  | {
      provider: Extract<PromptSDKFormat, "ANTHROPIC">;
      toolChoice: AnthropicToolChoice;
    }
  | {
      provider: Extract<PromptSDKFormat, "PHOENIX_PROMPT">;
      toolChoice: PromptToolChoice;
    }
  | {
      provider: Extract<PromptSDKFormat, "VERCEL_AI">;
      toolChoice: VercelAIToolChoice;
    }
  | { provider: null; toolChoice: null };
