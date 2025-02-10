import { z } from "zod";
import { PromptProviderSDKs } from "../../types/prompts";
import {
  anthropicMessagePartToOpenAIChatPart,
  anthropicMessageToOpenAI,
  anthropicToolCallToOpenAI,
  anthropicToolChoiceToOpenaiToolChoice,
  anthropicToolToOpenAI,
} from "./anthropic/converters";
import {
  openAIChatPartToAnthropicMessagePart,
  openAIMessageToAI,
  openAIMessageToAnthropic,
  openAIMessageToPrompt,
  openAIToolCallToAnthropic,
  openAIToolChoiceToAnthropicToolChoice,
  openAIToolChoiceToVercelToolChoice,
  openAIToolToAnthropic,
} from "./openai/converters";
import {
  phoenixResponseFormatToOpenAI,
  phoenixToolChoiceToOpenaiToolChoice,
  phoenixToolToOpenAI,
  promptMessagePartToOpenAIChatPart,
  promptMessageToOpenAI,
  promptToOpenAIToolCall,
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
      toOpenAI: anthropicMessagePartToOpenAIChatPart,
      fromOpenAI: openAIChatPartToAnthropicMessagePart,
    },
    toolChoices: {
      toOpenAI: anthropicToolChoiceToOpenaiToolChoice,
      fromOpenAI: openAIToolChoiceToAnthropicToolChoice,
    },
    toolCalls: {
      toOpenAI: anthropicToolCallToOpenAI,
      fromOpenAI: openAIToolCallToAnthropic,
    },
    toolDefinitions: {
      toOpenAI: anthropicToolToOpenAI,
      fromOpenAI: openAIToolToAnthropic,
    },
  }),
  PHOENIX_PROMPT: makeSDKConverters({
    messages: {
      toOpenAI: promptMessageToOpenAI,
      fromOpenAI: openAIMessageToPrompt,
    },
    messageParts: {
      toOpenAI: promptMessagePartToOpenAIChatPart,
      fromOpenAI: z.any(),
    },
    toolChoices: {
      toOpenAI: phoenixToolChoiceToOpenaiToolChoice,
      fromOpenAI: z.any(),
    },
    toolCalls: {
      toOpenAI: promptToOpenAIToolCall,
      fromOpenAI: z.any(),
    },
    toolDefinitions: {
      toOpenAI: phoenixToolToOpenAI,
      fromOpenAI: z.any(),
    },
    responseFormat: {
      toOpenAI: phoenixResponseFormatToOpenAI,
      fromOpenAI: z.any(),
    },
  }),
  VERCEL_AI: makeSDKConverters({
    messages: {
      toOpenAI: openAIMessageSchema,
      fromOpenAI: openAIMessageToAI,
    },
    messageParts: {
      fromOpenAI: vercelAIChatPartSchema,
      toOpenAI: openaiChatPartSchema,
    },
    toolChoices: {
      toOpenAI: openAIToolChoiceSchema,
      fromOpenAI: openAIToolChoiceToVercelToolChoice,
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
