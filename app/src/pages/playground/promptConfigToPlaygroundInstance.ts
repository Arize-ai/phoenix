import { getInvocationFamilyForProvider } from "@phoenix/pages/playground/invocationParameterSpecs";
import { objectToInvocationParameters } from "@phoenix/pages/playground/invocationParameterUtils";
import {
  deriveToolsAndOpenAIApiType,
  getChatRole,
  type GraphQLPromptTool,
} from "@phoenix/pages/playground/playgroundUtils";
import { emptyPromptInvocationParametersRecord } from "@phoenix/pages/playground/promptInvocationParameterCodecs";
import { readPromptInvocationParameters } from "@phoenix/pages/playground/PromptInvocationParametersReadableFragment";
import { fromPromptToolCallPart } from "@phoenix/schemas/toolCallSchemas";
import { generateMessageId } from "@phoenix/store/playground";
import type {
  ModelConfig,
  PlaygroundInstance,
} from "@phoenix/store/playground";
import { safelyStringifyJSON } from "@phoenix/utils/jsonUtils";
import {
  asTextPart,
  asToolCallPart,
  asToolResultPart,
} from "@phoenix/utils/promptUtils";

type PromptTemplateMessageLike = {
  role: string;
  content: readonly unknown[];
};

type PromptTemplateLike = {
  __typename: string;
  messages?: readonly PromptTemplateMessageLike[] | null;
};

type PromptToolChoiceLike = {
  type: "NONE" | "ZERO_OR_MORE" | "ONE_OR_MORE" | "SPECIFIC_FUNCTION";
  functionName?: string | null;
};

type PromptToolsLike = {
  tools: readonly GraphQLPromptTool[];
  toolChoice?: PromptToolChoiceLike | null;
} | null;

type PromptResponseFormatLike = {
  jsonSchema: {
    name: string;
    description?: string | null;
    schema?: unknown;
    strict?: boolean | null;
  };
} | null;

type PlaygroundChatTemplate = Extract<
  PlaygroundInstance["template"],
  { __type: "chat" }
>;

type PlaygroundInstanceFieldsFromPromptConfig = {
  model: PlaygroundInstance["model"];
  template: PlaygroundChatTemplate;
  tools: PlaygroundInstance["tools"];
  toolChoice: PlaygroundInstance["toolChoice"];
};

function promptToolChoiceToCanonicalToolChoice(
  rawToolChoice: PromptToolChoiceLike | null | undefined
): PlaygroundInstance["toolChoice"] {
  if (!rawToolChoice) {
    return undefined;
  }
  return {
    type: rawToolChoice.type,
    ...(rawToolChoice.functionName != null && {
      functionName: rawToolChoice.functionName,
    }),
  };
}

function promptTemplateToPlaygroundMessages({
  template,
  provider,
}: {
  template: PromptTemplateLike;
  provider: ModelProvider;
}): PlaygroundChatTemplate["messages"] {
  const promptMessages = template.messages;
  if (!promptMessages) {
    return [];
  }
  return promptMessages.map((message) => {
    const textContent = message.content
      .map(asTextPart)
      .filter((part): part is NonNullable<typeof part> => part != null)
      .map((part) => part.text.text)
      .join("");
    const toolCallParts = message.content
      .map(asToolCallPart)
      .filter((part): part is NonNullable<typeof part> => part != null);
    const toolResultParts = message.content
      .map(asToolResultPart)
      .filter((part): part is NonNullable<typeof part> => part != null);
    const firstToolResultPart = toolResultParts.at(0);
    const role = getChatRole(message.role);

    if (role === "tool" && firstToolResultPart) {
      return {
        id: generateMessageId(),
        role,
        content:
          typeof firstToolResultPart.toolResult.result === "string"
            ? firstToolResultPart.toolResult.result
            : safelyStringifyJSON(
                firstToolResultPart.toolResult.result,
                null,
                2
              ).json || "",
        toolCallId: firstToolResultPart.toolResult.toolCallId,
      };
    }

    if (role === "ai" && toolCallParts.length > 0) {
      return {
        id: generateMessageId(),
        role,
        toolCalls: toolCallParts.map((toolCallPart) =>
          fromPromptToolCallPart(toolCallPart, provider)
        ),
      };
    }

    return {
      id: generateMessageId(),
      role,
      content: textContent,
    };
  });
}

export function buildPlaygroundInstanceFieldsFromPromptConfig({
  provider,
  modelName,
  template,
  tools,
  invocationParametersRef,
  responseFormat,
  customProvider = null,
  connectionFields = {},
}: {
  provider: ModelProvider;
  modelName: string;
  template: PromptTemplateLike;
  tools: PromptToolsLike;
  invocationParametersRef: Parameters<typeof readPromptInvocationParameters>[0];
  responseFormat: PromptResponseFormatLike;
  customProvider?: ModelConfig["customProvider"];
  connectionFields?: Partial<
    Pick<ModelConfig, "baseUrl" | "endpoint" | "region" | "openaiApiType">
  >;
}): PlaygroundInstanceFieldsFromPromptConfig {
  const family = getInvocationFamilyForProvider(provider);
  const rawInvocationParameters =
    readPromptInvocationParameters(invocationParametersRef) ??
    emptyPromptInvocationParametersRecord(family);
  const derivedTools = deriveToolsAndOpenAIApiType(tools?.tools, provider);
  const isOpenAIProvider = provider === "OPENAI" || provider === "AZURE_OPENAI";
  const openaiApiType = isOpenAIProvider
    ? (connectionFields.openaiApiType ?? derivedTools.openaiApiType)
    : null;
  const invocationParameters = objectToInvocationParameters(
    rawInvocationParameters,
    { openaiApiType }
  );

  return {
    model: {
      modelName,
      provider,
      customProvider,
      responseFormat: responseFormat
        ? {
            type: "json_schema",
            jsonSchema: responseFormat.jsonSchema,
          }
        : null,
      invocationParameters,
      ...connectionFields,
      ...(openaiApiType != null && { openaiApiType }),
    },
    template: {
      __type: "chat",
      messages: promptTemplateToPlaygroundMessages({ template, provider }),
    },
    tools: derivedTools.tools,
    toolChoice: promptToolChoiceToCanonicalToolChoice(tools?.toolChoice),
  };
}
