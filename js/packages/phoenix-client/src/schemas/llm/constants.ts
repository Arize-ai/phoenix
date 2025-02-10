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
  phoenixPromptResponseFormatToOpenAI,
  phoenixPromptToolChoiceToOpenAI,
  phoenixPromptToolDefinitionToOpenAI,
  phoenixPromptMessagePartToOpenAI,
  phoenixPromptMessageToOpenAI,
  phoenixPromptToOpenAI,
} from "./phoenixPrompt/converters";
import { makeSDKConverters } from "./utils";
import { openAIMessageSchema } from "./openai/messageSchemas";
import {
  vercelAIChatPartSchema,
  vercelAIChatPartToolCallSchema,
} from "./ai/messagePartSchemas";
import { openaiChatPartSchema } from "./openai/messagePartSchemas";
import { openAIToolChoiceSchema } from "./openai/toolChoiceSchemas";
import { openAIToolCallSchema } from "./openai/toolCallSchemas";
import { openAIToolDefinitionSchema } from "./openai/toolSchemas";
import { openaiResponseFormatSchema } from "./openai/responseFormatSchema";

export const SDKProviderIdMap: Record<PromptProviderSDKs, string> = {
  OPENAI: "openai",
  AZURE_OPENAI: "azure-openai",
  ANTHROPIC: "anthropic",
  PHOENIX_PROMPT: "phoenix-prompt",
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
  PHOENIX_PROMPT: makeSDKConverters({
    messages: {
      toOpenAI: phoenixPromptMessageToOpenAI,
      fromOpenAI: openAIMessageToPhoenixPrompt,
    },
    messageParts: {
      toOpenAI: phoenixPromptMessagePartToOpenAI,
      fromOpenAI: z.any(),
    },
    toolChoices: {
      toOpenAI: phoenixPromptToolChoiceToOpenAI,
      fromOpenAI: z.any(),
    },
    toolCalls: {
      toOpenAI: phoenixPromptToOpenAI,
      fromOpenAI: z.any(),
    },
    toolDefinitions: {
      toOpenAI: phoenixPromptToolDefinitionToOpenAI,
      fromOpenAI: z.any(),
    },
    responseFormat: {
      toOpenAI: phoenixPromptResponseFormatToOpenAI,
      fromOpenAI: z.any(),
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
      fromOpenAI: z.any(),
    },
  }),
} satisfies Record<PromptProviderSDKs, unknown>;
