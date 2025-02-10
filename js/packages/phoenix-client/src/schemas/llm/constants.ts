import { z } from "zod";
import { PromptProviderSDKs } from "../../types/prompts";
import {
  anthropicMessagePartToOpenAI,
  anthropicMessageToOpenAI,
  anthropicToolCallToOpenAI,
  anthropicToolChoiceToOpenAI,
  anthropicToolDefinitionToOpenAI,
} from "./anthropic/converters";
import {
  openAIChatPartToAnthropic,
  openAIMessageToVercelAI,
  openAIMessageToAnthropic,
  openAIMessageToPhoenixPrompt,
  openAIToolCallToAnthropic,
  openAIToolChoiceToAnthropic,
  openAIToolChoiceToVercelAI,
  openAIToolDefinitionToAnthropic,
} from "./openai/converters";
import {
  phoenixResponseFormatToOpenAI,
  phoenixToolChoiceToOpenAI,
  phoenixToolDefinitionToOpenAI,
  phoenixMessagePartToOpenAI,
  phoenixMessageToOpenAI,
  phoenixToolCallToOpenAI,
} from "./phoenixPrompt/converters";
import { makeSDKConverters } from "./utils";
import { openAIMessageSchema } from "./openai/messageSchemas";
import {
  vercelAIChatPartSchema,
  vercelAIChatPartToolCallSchema,
} from "./vercel/messagePartSchemas";
import { openaiChatPartSchema } from "./openai/messagePartSchemas";
import { openAIToolChoiceSchema } from "./openai/toolChoiceSchemas";
import { openAIToolCallSchema } from "./openai/toolCallSchemas";
import { openAIToolDefinitionSchema } from "./openai/toolSchemas";
import { openaiResponseFormatSchema } from "./openai/responseFormatSchema";

export const SDKProviderIdMap: Record<PromptProviderSDKs, string> = {
  OPENAI: "openai",
  AZURE_OPENAI: "azure-openai",
  ANTHROPIC: "anthropic",
  PHOENIX: "phoenix",
  VERCEL_AI: "ai",
};

const OPENAI = makeSDKConverters({
  messages: {
    toOpenAI: openAIMessageSchema,
    fromOpenAI: openAIMessageSchema,
  },
  messageParts: {
    toOpenAI: openaiChatPartSchema,
    fromOpenAI: openaiChatPartSchema,
  },
  toolChoices: {
    toOpenAI: openAIToolChoiceSchema,
    fromOpenAI: openAIToolChoiceSchema,
  },
  toolCalls: {
    toOpenAI: openAIToolCallSchema,
    fromOpenAI: openAIToolCallSchema,
  },
  toolDefinitions: {
    toOpenAI: openAIToolDefinitionSchema,
    fromOpenAI: openAIToolDefinitionSchema,
  },
  responseFormat: {
    toOpenAI: openaiResponseFormatSchema,
    fromOpenAI: openaiResponseFormatSchema,
  },
});

/**
 * SDK Provider Converter Map
 *
 * This map contains the converters for each SDK provider.
 *
 * If a "from" direction is not supported for a particular provider, you can set the schema to `z.unknown()`,
 * passing contents directly through, but forcing the caller to handle the unknown type.
 */
export const SDKProviderConverterMap = {
  OPENAI,
  AZURE_OPENAI: OPENAI,
  ANTHROPIC: makeSDKConverters({
    messages: {
      toOpenAI: anthropicMessageToOpenAI,
      fromOpenAI: openAIMessageToAnthropic,
    },
    messageParts: {
      toOpenAI: anthropicMessagePartToOpenAI,
      fromOpenAI: openAIChatPartToAnthropic,
    },
    toolChoices: {
      toOpenAI: anthropicToolChoiceToOpenAI,
      fromOpenAI: openAIToolChoiceToAnthropic,
    },
    toolCalls: {
      toOpenAI: anthropicToolCallToOpenAI,
      fromOpenAI: openAIToolCallToAnthropic,
    },
    toolDefinitions: {
      toOpenAI: anthropicToolDefinitionToOpenAI,
      fromOpenAI: openAIToolDefinitionToAnthropic,
    },
  }),
  PHOENIX: makeSDKConverters({
    messages: {
      toOpenAI: phoenixMessageToOpenAI,
      fromOpenAI: openAIMessageToPhoenixPrompt,
    },
    messageParts: {
      toOpenAI: phoenixMessagePartToOpenAI,
      fromOpenAI: z.unknown(),
    },
    toolChoices: {
      toOpenAI: phoenixToolChoiceToOpenAI,
      fromOpenAI: z.unknown(),
    },
    toolCalls: {
      toOpenAI: phoenixToolCallToOpenAI,
      fromOpenAI: z.unknown(),
    },
    toolDefinitions: {
      toOpenAI: phoenixToolDefinitionToOpenAI,
      fromOpenAI: z.unknown(),
    },
    responseFormat: {
      toOpenAI: phoenixResponseFormatToOpenAI,
      fromOpenAI: z.unknown(),
    },
  }),
  VERCEL_AI: makeSDKConverters({
    messages: {
      toOpenAI: openAIMessageSchema,
      fromOpenAI: openAIMessageToVercelAI,
    },
    messageParts: {
      fromOpenAI: vercelAIChatPartSchema,
      toOpenAI: openaiChatPartSchema,
    },
    toolChoices: {
      toOpenAI: openAIToolChoiceSchema,
      fromOpenAI: openAIToolChoiceToVercelAI,
    },
    toolCalls: {
      toOpenAI: openAIToolCallSchema,
      fromOpenAI: vercelAIChatPartToolCallSchema,
    },
    toolDefinitions: {
      toOpenAI: openAIToolDefinitionSchema,
      fromOpenAI: z.unknown(),
    },
  }),
} satisfies Record<PromptProviderSDKs, unknown>;
