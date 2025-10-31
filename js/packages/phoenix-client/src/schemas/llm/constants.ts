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
  openAIMessageToAnthropic,
  openAIMessageToPhoenixPrompt,
  openAIMessageToVercelAI,
  openAIToolCallToAnthropic,
  openAIToolChoiceToAnthropic,
  openAIToolChoiceToVercelAI,
  openAIToolDefinitionToAnthropic,
  openAIToolDefinitionToVercelAI,
} from "./openai/converters";
import { openaiChatPartSchema } from "./openai/messagePartSchemas";
import { openAIMessageSchema } from "./openai/messageSchemas";
import { openaiResponseFormatSchema } from "./openai/responseFormatSchema";
import { openAIToolCallSchema } from "./openai/toolCallSchemas";
import { openAIToolChoiceSchema } from "./openai/toolChoiceSchemas";
import { openAIToolDefinitionSchema } from "./openai/toolSchemas";
import {
  phoenixMessagePartToOpenAI,
  phoenixMessageToOpenAI,
  phoenixResponseFormatToOpenAI,
  phoenixToolCallToOpenAI,
  phoenixToolChoiceToOpenAI,
  phoenixToolDefinitionToOpenAI,
} from "./phoenixPrompt/converters";
import {
  vercelAIChatPartSchema,
  vercelAIChatPartToolCallSchema,
} from "./vercel/messagePartSchemas";
import { makeSDKConverters } from "./utils";

import { z } from "zod";

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
      fromOpenAI: openAIToolDefinitionToVercelAI,
    },
  }),
} satisfies Record<PromptProviderSDKs, unknown>;
