import type { ZodType, ZodTypeAny, ZodTypeDef } from "zod";

import type { PromptProviderSDKs, PromptToolChoice } from "../../types/prompts";
import type { AnthropicMessagePart } from "./anthropic/messagePartSchemas";
import type { AnthropicMessage } from "./anthropic/messageSchemas";
import type { AnthropicToolCall } from "./anthropic/toolCallSchemas";
import type { AnthropicToolChoice } from "./anthropic/toolChoiceSchemas";
import type { AnthropicToolDefinition } from "./anthropic/toolSchemas";
import type { OpenAIChatPart } from "./openai/messagePartSchemas";
import type { OpenAIMessage } from "./openai/messageSchemas";
import type { OpenAIResponseFormat } from "./openai/responseFormatSchema";
import type { OpenAIToolCall } from "./openai/toolCallSchemas";
import type { OpenaiToolChoice } from "./openai/toolChoiceSchemas";
import type { OpenAIToolDefinition } from "./openai/toolSchemas";
import type { PhoenixContentPart } from "./phoenixPrompt/messagePartSchemas";
import type { PhoenixMessage } from "./phoenixPrompt/messageSchemas";
import type { PhoenixToolCall } from "./phoenixPrompt/toolCallSchemas";
import type { PhoenixToolDefinition } from "./phoenixPrompt/toolSchemas";
import type {
  VercelAIChatPart,
  VercelAIChatPartToolCall,
} from "./vercel/messagePartSchemas";
import type { VercelAIMessage } from "./vercel/messageSchemas";
import type { VercelAIToolChoice } from "./vercel/toolChoiceSchemas";
import type { VercelAIToolDefinition } from "./vercel/toolSchemas";

export type PromptSDKFormat = PromptProviderSDKs | null;

export type LLMMessagePart =
  | OpenAIChatPart
  | AnthropicMessagePart
  | PhoenixContentPart
  | VercelAIChatPart;

export type SDKConverters<
  MessageSchema extends ZodTypeAny = never,
  MessagePartSchema extends ZodTypeAny = never,
  ToolChoiceSchema extends ZodTypeAny = never,
  ToolCallSchema extends ZodTypeAny = never,
  ToolDefinitionSchema extends ZodTypeAny = never,
  ResponseFormatSchema extends ZodTypeAny = never,
> = {
  messages: {
    toOpenAI: ZodType<OpenAIMessage | null, ZodTypeDef, unknown>;
    fromOpenAI: MessageSchema;
  };
  messageParts: {
    toOpenAI: ZodType<OpenAIChatPart | null, ZodTypeDef, unknown>;
    fromOpenAI: MessagePartSchema;
  };
  toolChoices: {
    toOpenAI: ZodType<OpenaiToolChoice | null, ZodTypeDef, unknown>;
    fromOpenAI: ToolChoiceSchema;
  };
  toolCalls: {
    toOpenAI: ZodType<OpenAIToolCall | null, ZodTypeDef, unknown>;
    fromOpenAI: ToolCallSchema;
  };
  toolDefinitions: {
    toOpenAI: ZodType<OpenAIToolDefinition | null, ZodTypeDef, unknown>;
    fromOpenAI: ToolDefinitionSchema;
  };
  responseFormat?: {
    toOpenAI: ZodType<OpenAIResponseFormat | null, ZodTypeDef, unknown>;
    fromOpenAI: ResponseFormatSchema;
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
      provider: Extract<PromptSDKFormat, "PHOENIX">;
      validatedMessage: PhoenixContentPart;
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
      provider: Extract<PromptSDKFormat, "PHOENIX">;
      validatedMessage: PhoenixMessage;
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
      provider: Extract<PromptSDKFormat, "PHOENIX">;
      validatedToolDefinition: PhoenixToolDefinition;
    }
  | {
      provider: Extract<PromptSDKFormat, "VERCEL_AI">;
      validatedToolDefinition: VercelAIToolDefinition;
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
      provider: Extract<PromptSDKFormat, "PHOENIX">;
      validatedToolCall: PhoenixToolCall;
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
      provider: Extract<PromptSDKFormat, "PHOENIX">;
      toolChoice: PromptToolChoice;
    }
  | {
      provider: Extract<PromptSDKFormat, "VERCEL_AI">;
      toolChoice: VercelAIToolChoice;
    }
  | { provider: null; toolChoice: null };
