import { z } from "zod";

import { LLMProvider } from "@arizeai/openinference-semantic-conventions";

import { TemplateFormats } from "@phoenix/components/templateEditor/constants";
import { getTemplateFormatUtils } from "@phoenix/components/templateEditor/templateEditorUtils";
import { TemplateFormat } from "@phoenix/components/templateEditor/types";
import {
  ChatRoleMap,
  DEFAULT_CHAT_ROLE,
  DEFAULT_MODEL_PROVIDER,
} from "@phoenix/constants/generativeConstants";
import {
  createAnthropicToolDefinition,
  createOpenAIToolDefinition,
  detectToolDefinitionProvider,
} from "@phoenix/schemas";
import { JSONLiteral } from "@phoenix/schemas/jsonLiteralSchema";
import {
  AnthropicToolCall,
  createAnthropicToolCall,
  createOpenAIToolCall,
  LlmProviderToolCall,
  OpenAIToolCall,
} from "@phoenix/schemas/toolCallSchemas";
import { safelyConvertToolChoiceToProvider } from "@phoenix/schemas/toolChoiceSchemas";
import {
  ChatMessage,
  createNormalizedPlaygroundInstance,
  CredentialsState,
  generateMessageId,
  generateToolId,
  ModelConfig,
  PlaygroundInput,
  PlaygroundInstance,
  PlaygroundNormalizedInstance,
  PlaygroundStore,
  Tool,
} from "@phoenix/store";
import {
  assertUnreachable,
  isStringKeyedObject,
  Mutable,
} from "@phoenix/typeUtils";
import { safelyParseJSON } from "@phoenix/utils/jsonUtils";

import { ChatCompletionOverDatasetInput } from "./__generated__/PlaygroundDatasetExamplesTableSubscription.graphql";
import {
  ChatCompletionInput,
  ChatCompletionMessageInput,
  ChatCompletionMessageRole,
  InvocationParameterInput,
} from "./__generated__/PlaygroundOutputSubscription.graphql";
import {
  INPUT_MESSAGES_PARSING_ERROR,
  MODEL_CONFIG_PARSING_ERROR,
  MODEL_CONFIG_WITH_INVOCATION_PARAMETERS_PARSING_ERROR,
  MODEL_CONFIG_WITH_RESPONSE_FORMAT_PARSING_ERROR,
  modelProviderToModelPrefixMap,
  OUTPUT_MESSAGES_PARSING_ERROR,
  OUTPUT_VALUE_PARSING_ERROR,
  PROMPT_TEMPLATE_VARIABLES_PARSING_ERROR,
  RESPONSE_FORMAT_PARAM_CANONICAL_NAME,
  RESPONSE_FORMAT_PARAM_NAME,
  SPAN_ATTRIBUTES_PARSING_ERROR,
  TOOL_CHOICE_PARAM_CANONICAL_NAME,
  TOOL_CHOICE_PARAM_NAME,
  TOOLS_PARSING_ERROR,
} from "./constants";
import { InvocationParameter } from "./InvocationParametersFormFields";
import {
  chatMessageRolesSchema,
  chatMessagesSchema,
  JsonObjectSchema,
  llmInputMessageSchema,
  llmOutputMessageSchema,
  LlmToolSchema,
  llmToolSchema,
  MessageSchema,
  modelConfigSchema,
  modelConfigWithInvocationParametersSchema,
  modelConfigWithResponseFormatSchema,
  outputSchema,
  promptTemplateSchema,
  urlSchema,
} from "./schemas";
import { PlaygroundSpan } from "./spanPlaygroundPageLoader";

/**
 * Checks if a string is a valid chat message role
 */
export function isChatMessageRole(role: unknown): role is ChatMessageRole {
  return chatMessageRolesSchema.safeParse(role).success;
}

/**
 * Takes a string role and attempts to map the role to a valid ChatMessageRole.
 * If the role is not found, it will default to {@link DEFAULT_CHAT_ROLE}.
 * @param role the role to map
 * @returns ChatMessageRole
 *
 * NB: Only exported for testing
 */
export function getChatRole(_role: string): ChatMessageRole {
  const role = _role.toLowerCase();
  if (isChatMessageRole(role)) {
    return role;
  }

  for (const [chatRole, acceptedValues] of Object.entries(ChatRoleMap)) {
    if (acceptedValues.includes(role)) {
      return chatRole as ChatMessageRole;
    }
  }
  return DEFAULT_CHAT_ROLE;
}

/**
 * Takes tool calls on a message from span attributes and a provider and transforms them into the corresponding providers tool calls for a message in the playground
 * @param toolCalls Tool calls from a spans message to transform into tool calls from a chat message in the playground
 * @param provider the provider of the model
 * @returns Tool calls for a message in the playground
 *
 * NB: Only exported for testing
 */
export function processAttributeToolCalls({
  toolCalls,
  provider,
}: {
  toolCalls?: MessageSchema["message"]["tool_calls"];
  provider: ModelProvider;
}): ChatMessage["toolCalls"] {
  if (toolCalls == null) {
    return;
  }
  return toolCalls
    .map(({ tool_call }) => {
      if (tool_call == null) {
        return null;
      }

      let toolCallArgs: Record<string, unknown> = {};
      if (tool_call.function?.arguments != null) {
        const { json: parsedArguments } = safelyParseJSON(
          tool_call.function.arguments
        );
        if (isStringKeyedObject(parsedArguments)) {
          toolCallArgs = parsedArguments;
        }
      }

      switch (provider) {
        case "OPENAI":
        case "AZURE_OPENAI":
          return {
            id: tool_call.id ?? "",
            type: "function" as const,
            function: {
              name: tool_call.function?.name ?? "",
              arguments: toolCallArgs,
            },
          } satisfies OpenAIToolCall;
        case "ANTHROPIC": {
          return {
            id: tool_call.id ?? "",
            type: "tool_use" as const,
            name: tool_call.function?.name ?? "",
            input: toolCallArgs,
          } satisfies AnthropicToolCall;
        }
        // TODO(apowell): #5348 Add Google tool call
        case "GOOGLE":
          return {
            id: tool_call.id ?? "",
            function: {
              name: tool_call.function?.name ?? "",
              arguments: toolCallArgs,
            },
          } as JSONLiteral;
        default:
          assertUnreachable(provider);
      }
    })
    .filter((toolCall): toolCall is NonNullable<typeof toolCall> => {
      return toolCall != null;
    });
}

/**
 * Takes a list of messages from span attributes and transforms them into a list of {@link ChatMessage|ChatMessages} and the model provider of the message
 * @param messages messages from attributes either input or output @see {@link https://github.com/Arize-ai/openinference/blob/main/spec/semantic_conventions.md|Semantic Conventions}}
 * returns a list of {@link ChatMessage|ChatMessages}
 */
function processAttributeMessagesToChatMessage({
  messages,
  provider,
}: {
  messages: MessageSchema[];
  provider: ModelProvider;
}): ChatMessage[] {
  return messages.map(({ message }) => {
    return {
      id: generateMessageId(),
      // if the message has a tool call id, it is a tool "role" message from the perspective of the playground
      role:
        message.tool_call_id != null
          ? getChatRole("tool")
          : getChatRole(message.role),
      // TODO: truly support multi-part message contents
      // for now, just take the first text based message if it exists
      content: Array.isArray(message.contents)
        ? (message.contents.find(
            (content) => content.message_content.type === "text"
          )?.message_content?.text ?? undefined)
        : typeof message.content === "string"
          ? message.content
          : undefined,
      toolCalls: processAttributeToolCalls({
        provider,
        toolCalls: message.tool_calls,
      }),
      toolCallId: message.tool_call_id,
    };
  });
}

/**
 * Attempts to parse the input messages from the span attributes.
 * @param parsedAttributes the JSON parsed span attributes
 * @returns an object containing the parsed {@link ChatMessage|ChatMessages} and any parsing errors
 *
 * NB: Only exported for testing
 */
export function getTemplateMessagesFromAttributes({
  provider,
  parsedAttributes,
}: {
  provider: ModelProvider;
  parsedAttributes: unknown;
}) {
  const inputMessages = llmInputMessageSchema.safeParse(parsedAttributes);
  if (!inputMessages.success) {
    return {
      messageParsingErrors: [INPUT_MESSAGES_PARSING_ERROR],
      messages: null,
    };
  }
  if (provider === "ANTHROPIC") {
    const { success, data } =
      modelConfigWithInvocationParametersSchema.safeParse(parsedAttributes);
    if (success) {
      const messages = inputMessages.data.llm.input_messages;
      const systemPrompt = data.llm.invocation_parameters?.system;
      if (
        typeof systemPrompt === "string" &&
        systemPrompt &&
        (!messages || messages[0].message.role !== "system")
      ) {
        inputMessages.data.llm.input_messages.unshift({
          message: {
            role: "system",
            content: systemPrompt,
          },
        });
      }
    }
  }
  return {
    messageParsingErrors: [],
    messages: processAttributeMessagesToChatMessage({
      provider,
      messages: inputMessages.data.llm.input_messages,
    }),
  };
}

/**
 * Attempts to get llm.output_messages then output.value from the span attributes.
 * @param parsedAttributes the JSON parsed span attributes
 * @returns an object containing the parsed output and any parsing errors
 *
 * NB: Only exported for testing
 */
export function getOutputFromAttributes({
  provider,
  parsedAttributes,
}: {
  provider: ModelProvider;
  parsedAttributes: unknown;
}) {
  const outputParsingErrors: string[] = [];
  const outputMessages = llmOutputMessageSchema.safeParse(parsedAttributes);
  if (outputMessages.success) {
    return {
      output: processAttributeMessagesToChatMessage({
        provider,
        messages: outputMessages.data.llm.output_messages,
      }),
      outputParsingErrors,
    };
  }

  outputParsingErrors.push(OUTPUT_MESSAGES_PARSING_ERROR);

  const parsedOutput = outputSchema.safeParse(parsedAttributes);
  if (parsedOutput.success) {
    return {
      output: parsedOutput.data.output.value,
      outputParsingErrors,
    };
  }

  outputParsingErrors.push(OUTPUT_VALUE_PARSING_ERROR);

  return {
    output: undefined,
    outputParsingErrors,
  };
}

/**
 * Converts an OpenInference model provider to a Phoenix model provider.
 * @param provider the OpenInference model provider
 * @returns the Phoenix model provider or null if the provider is not supported / defined
 */
export function openInferenceModelProviderToPhoenixModelProvider(
  provider: string | undefined | null
): ModelProvider | null {
  if (provider == null) {
    return null;
  }
  const maybeProvider = provider.toLowerCase() as LLMProvider;
  switch (maybeProvider) {
    case "openai":
      return "OPENAI";
    case "anthropic":
      return "ANTHROPIC";
    case "google":
      return "GOOGLE";
    case "azure":
      return "AZURE_OPENAI";
    default:
      return null;
  }
}

/**
 * Attempts to infer the provider of the model from the model name.
 * @param modelName the model name to get the provider from
 * @returns the provider of the model defaulting to {@link DEFAULT_MODEL_PROVIDER} if the provider cannot be inferred
 *
 * NB: Only exported for testing
 */
export function getModelProviderFromModelName(
  modelName: string
): ModelProvider {
  for (const provider of Object.keys(modelProviderToModelPrefixMap)) {
    const prefixes = modelProviderToModelPrefixMap[provider as ModelProvider];
    if (prefixes.some((prefix) => modelName.includes(prefix))) {
      return provider as ModelProvider;
    }
  }
  return DEFAULT_MODEL_PROVIDER;
}

/**
 * Attempts to get the llm.model_name, inferred provider, and invocation parameters from the span attributes.
 * @param parsedAttributes the JSON parsed span attributes
 * @returns the model config if it exists or parsing errors if it does not
 *
 * NB: Only exported for testing
 */
export function getBaseModelConfigFromAttributes(parsedAttributes: unknown): {
  modelConfig: ModelConfig | null;
  parsingErrors: string[];
} {
  const { success, data } = modelConfigSchema.safeParse(parsedAttributes);
  if (success) {
    const provider =
      openInferenceModelProviderToPhoenixModelProvider(data.llm.provider) ||
      getModelProviderFromModelName(data.llm.model_name);
    const urlInfo = getUrlInfoFromAttributes(parsedAttributes);
    return {
      modelConfig: {
        ...Object.fromEntries(
          Object.entries(urlInfo).filter(([_, value]) => value !== null)
        ),
        modelName: data.llm.model_name,
        provider,
        invocationParameters: [],
        supportedInvocationParameters: [],
      },
      parsingErrors: [],
    };
  }
  return { modelConfig: null, parsingErrors: [MODEL_CONFIG_PARSING_ERROR] };
}

export function getUrlInfoFromAttributes(parsedAttributes: unknown): {
  baseUrl: string | null;
  endpoint: string | null;
  apiVersion: string | null;
} {
  const { success, data } = urlSchema.safeParse(parsedAttributes);
  if (success) {
    try {
      const url = new URL(data.url.full);
      let baseUrl = url;
      if (data.url.path) {
        try {
          baseUrl = new URL(data.url.full.split(data.url.path)[0]);
        } catch (_) {
          // If the split URL is invalid, we will just use the full URL
        }
      }
      return {
        baseUrl: `${baseUrl.origin}${baseUrl.pathname}`,
        endpoint: url.origin,
        apiVersion: url.searchParams.get("api-version") || null,
      };
    } catch (_) {
      // If the URL is invalid, we will just return null for all values
    }
  }
  return {
    baseUrl: null,
    apiVersion: null,
    endpoint: null,
  };
}

/**
 * Attempts to get llm.invocation_parameters from the span attributes.
 * Invocation parameters are then massaged into the InvocationParameterInput type.
 * @param parsedAttributes the JSON parsed span attributes
 * @param modelSupportedInvocationParameters the model supported invocation parameters
 * @returns the invocation parameters from the span attributes
 *
 * NB: Only exported for testing
 */
export function getModelInvocationParametersFromAttributes(
  parsedAttributes: unknown,
  modelSupportedInvocationParameters: InvocationParameter[] = []
): {
  invocationParameters: InvocationParameterInput[];
  parsingErrors: string[];
} {
  const { success, data } =
    modelConfigWithInvocationParametersSchema.safeParse(parsedAttributes);
  const parsingErrors: string[] = [];

  if (!success) {
    parsingErrors.push(MODEL_CONFIG_WITH_INVOCATION_PARAMETERS_PARSING_ERROR);
  }

  const invocationParameters =
    transformInvocationParametersFromAttributesToInvocationParameterInputs(
      data?.llm.invocation_parameters ?? {},
      modelSupportedInvocationParameters
    );

  return {
    invocationParameters,
    parsingErrors,
  };
}

export function getResponseFormatFromAttributes(parsedAttributes: unknown) {
  const { success, data } =
    modelConfigWithResponseFormatSchema.safeParse(parsedAttributes);
  if (!success) {
    return {
      responseFormat: undefined,
      parsingErrors: [MODEL_CONFIG_WITH_RESPONSE_FORMAT_PARSING_ERROR],
    };
  }
  return {
    responseFormat: data.llm.invocation_parameters.response_format,
    parsingErrors: [],
  };
}

/**
 * Processes the tools from the span attributes into OpenAI tools to be used in the playground
 * @param tools tools from the span attributes
 * @returns playground OpenAI tools
 */
function processAttributeTools(tools: LlmToolSchema): Tool[] {
  return (tools?.llm?.tools ?? [])
    .map((tool) => {
      if (tool?.tool == null) {
        return null;
      }
      return {
        id: generateToolId(),
        definition: tool.tool.json_schema,
      };
    })
    .filter((tool): tool is NonNullable<typeof tool> => tool != null);
}

/**
 * Attempts to get llm.tools from the span attributes.
 * @param parsedAttributes the JSON parsed span attributes
 * @returns the tools from the span attributes
 *
 * NB: Only exported for testing
 */
export function getToolsFromAttributes(
  parsedAttributes: unknown
):
  | { tools: Tool[]; parsingErrors: never[] }
  | { tools: null; parsingErrors: string[] } {
  const { data, success } = llmToolSchema.safeParse(parsedAttributes);

  if (!success) {
    return { tools: null, parsingErrors: [TOOLS_PARSING_ERROR] };
  }
  // If there are no tools or llm attributes, we don't want to return parsing errors, it just means the span didn't have tools
  if (data?.llm?.tools == null) {
    return { tools: null, parsingErrors: [] };
  }
  return { tools: processAttributeTools(data), parsingErrors: [] };
}

export function getPromptTemplateVariablesFromAttributes(
  parsedAttributes: unknown
):
  | { variables: Record<string, string | undefined>; parsingErrors: never[] }
  | { variables: null; parsingErrors: string[] } {
  const { success, data } = promptTemplateSchema.safeParse(parsedAttributes);
  if (!success) {
    return {
      variables: null,
      parsingErrors: [PROMPT_TEMPLATE_VARIABLES_PARSING_ERROR],
    };
  }

  // If there is no template or llm attributes, we don't want to return parsing errors, it just means the span didn't have a prompt template
  if (data?.llm?.prompt_template == null) {
    return {
      variables: null,
      parsingErrors: [],
    };
  }
  return {
    variables: data.llm.prompt_template.variables,
    parsingErrors: [],
  };
}

/**
 * Takes a  {@link PlaygroundSpan|Span} and attempts to transform it's attributes into various fields on a {@link PlaygroundInstance}.
 * @param span the {@link PlaygroundSpan|Span} to transform into a playground instance
 * @returns a {@link PlaygroundInstance} with certain fields pre-populated from the span attributes
 */
export function transformSpanAttributesToPlaygroundInstance(
  span: PlaygroundSpan
): {
  playgroundInstance: PlaygroundInstance;
  /**
   * Errors that occurred during parsing of initial playground data.
   * For example, when coming from a span to the playground, the span may
   * not have the correct attributes, or the attributes may be of the wrong shape.
   * This field is used to store any issues encountered when parsing to display in the playground.
   */
  parsingErrors: string[];
  playgroundInput?: PlaygroundInput;
} {
  const { instance, instanceMessages } = createNormalizedPlaygroundInstance();
  const basePlaygroundInstance: PlaygroundInstance = {
    ...instance,
    template: {
      __type: "chat",
      messages: Object.values(instanceMessages),
    },
  };
  const { json: parsedAttributes, parseError } = safelyParseJSON(
    span.attributes
  );
  if (parseError) {
    return {
      playgroundInstance: {
        ...basePlaygroundInstance,
        spanId: span?.id ?? null,
      },
      parsingErrors: [SPAN_ATTRIBUTES_PARSING_ERROR],
    };
  }

  const modelSupportedInvocationParameters =
    span.invocationParameters as Mutable<InvocationParameter[]>;

  const baseModelConfigResult =
    getBaseModelConfigFromAttributes(parsedAttributes);
  let { modelConfig } = baseModelConfigResult;
  const { parsingErrors: modelConfigParsingErrors } = baseModelConfigResult;
  const { messages: rawMessages, messageParsingErrors } =
    getTemplateMessagesFromAttributes({
      provider: modelConfig?.provider ?? basePlaygroundInstance.model.provider,
      parsedAttributes,
    });
  const { output, outputParsingErrors } = getOutputFromAttributes({
    provider: modelConfig?.provider ?? basePlaygroundInstance.model.provider,
    parsedAttributes,
  });

  const {
    invocationParameters,
    parsingErrors: invocationParametersParsingErrors,
  } = getModelInvocationParametersFromAttributes(
    parsedAttributes,
    modelSupportedInvocationParameters
  );
  const { variables, parsingErrors: promptTemplateVariablesParsingErrors } =
    getPromptTemplateVariablesFromAttributes(parsedAttributes);
  // parse response format separately so that we can get distinct errors messages from the rest of
  // the invocation parameters
  const { parsingErrors: responseFormatParsingErrors } =
    getResponseFormatFromAttributes(parsedAttributes);

  // Merge invocation parameters into model config, if model config is present
  modelConfig =
    modelConfig != null
      ? {
          ...modelConfig,
          invocationParameters:
            // remove response format from invocation parameters if there are parsing errors
            responseFormatParsingErrors.length > 0
              ? invocationParameters.filter(
                  (param) =>
                    param.invocationName !== RESPONSE_FORMAT_PARAM_NAME &&
                    param.canonicalName !== RESPONSE_FORMAT_PARAM_CANONICAL_NAME
                )
              : invocationParameters,
        }
      : null;

  const { tools, parsingErrors: toolsParsingErrors } =
    getToolsFromAttributes(parsedAttributes);

  const messages = rawMessages?.map((message) => {
    return {
      ...message,
      // If the message is a tool message, we need to normalize the content
      content:
        message.role === "tool"
          ? normalizeMessageContent(message.content)
          : message.content,
    };
  });

  // TODO(parker): add support for prompt template variables
  // https://github.com/Arize-ai/phoenix/issues/4886
  return {
    playgroundInstance: {
      ...basePlaygroundInstance,
      model: modelConfig ?? basePlaygroundInstance.model,
      template:
        messages != null
          ? {
              __type: "chat",
              messages,
            }
          : basePlaygroundInstance.template,
      output,
      spanId: span.id,
      tools: tools ?? basePlaygroundInstance.tools,
    },
    playgroundInput:
      variables != null ? { variablesValueCache: variables } : undefined,
    parsingErrors: [
      ...messageParsingErrors,
      ...outputParsingErrors,
      ...modelConfigParsingErrors,
      ...toolsParsingErrors,
      ...invocationParametersParsingErrors,
      ...responseFormatParsingErrors,
      ...promptTemplateVariablesParsingErrors,
    ],
  };
}

/**
 * Checks if something is a valid {@link ChatMessage}
 */
export const isChatMessages = (
  messages: unknown
): messages is ChatMessage[] => {
  return chatMessagesSchema.safeParse(messages).success;
};

export const extractVariablesFromInstance = ({
  instance,
  templateFormat,
}: {
  instance: PlaygroundInstance;
  templateFormat: TemplateFormat;
}) => {
  if (templateFormat == TemplateFormats.NONE) {
    return [];
  }
  const variables = new Set<string>();
  const instanceType = instance.template.__type;
  const utils = getTemplateFormatUtils(templateFormat);
  // this double nested loop should be okay since we don't expect more than 4 instances
  // and a handful of messages per instance
  switch (instanceType) {
    case "chat": {
      // for each chat message in the instance
      instance.template.messages.forEach((message) => {
        // extract variables from the message content
        const extractedVariables =
          message.content == null
            ? []
            : utils.extractVariables(message.content);
        extractedVariables.forEach((variable) => {
          variables.add(variable);
        });
      });
      break;
    }
    case "text_completion": {
      const extractedVariables = utils.extractVariables(
        instance.template.prompt
      );
      extractedVariables.forEach((variable) => {
        variables.add(variable);
      });
      break;
    }
    default: {
      assertUnreachable(instanceType);
    }
  }
  return Array.from(variables);
};

export const extractVariablesFromInstances = ({
  instances,
  templateFormat,
}: {
  instances: PlaygroundInstance[];
  templateFormat: TemplateFormat;
}) => {
  if (templateFormat == TemplateFormats.NONE) {
    return [];
  }
  return Array.from(
    new Set(
      instances.flatMap((instance) =>
        extractVariablesFromInstance({ instance, templateFormat })
      )
    )
  );
};

export const getVariablesMapFromInstances = ({
  instances,
  templateFormat,
  input,
}: {
  instances: PlaygroundInstance[];
  templateFormat: TemplateFormat;
  input: PlaygroundInput;
}) => {
  if (templateFormat == TemplateFormats.NONE) {
    return { variablesMap: {}, variableKeys: [] };
  }
  const variableKeys = extractVariablesFromInstances({
    instances,
    templateFormat,
  });

  const variableValueCache = input.variablesValueCache ?? {};

  const variablesMap = variableKeys.reduce(
    (acc, key) => {
      acc[key] = variableValueCache[key] || "";
      return acc;
    },
    {} as NonNullable<PlaygroundInput["variablesValueCache"]>
  );
  return { variablesMap, variableKeys };
};

export function areInvocationParamsEqual(
  paramA: InvocationParameter | InvocationParameterInput,
  paramB: InvocationParameter | InvocationParameterInput
) {
  return (
    paramA.invocationName === paramB.invocationName ||
    // loose null comparison to catch undefined and null
    (paramA.canonicalName != null &&
      paramB.canonicalName != null &&
      paramA.canonicalName === paramB.canonicalName)
  );
}

/**
 * Filter out parameters that are not supported by a model's invocation parameter schema definitions.
 */
export const constrainInvocationParameterInputsToDefinition = (
  invocationParameterInputs: InvocationParameterInput[],
  definitions: InvocationParameter[]
) => {
  return invocationParameterInputs
    .filter((ip) =>
      // An input should be kept if it matches an invocation name in the definitions
      // or if it has a canonical name that matches a canonical name in the definitions.
      definitions.some((mp) => areInvocationParamsEqual(mp, ip))
    )
    .map((ip) => ({
      // Transform the invocationName to match the new name from the incoming
      // modelSupportedInvocationParameters.
      ...ip,
      invocationName:
        definitions.find((mp) => areInvocationParamsEqual(mp, ip))
          ?.invocationName ?? ip.invocationName,
    }));
};

/**
 * Converts a string from snake_case to camelCase.
 */
export const toCamelCase = (str: string) =>
  str.replace(/_([a-z])/g, (_, char) => char.toUpperCase());

/**
 * Transform invocation parameters from span attributes into InvocationParameterInput type.
 */
export const transformInvocationParametersFromAttributesToInvocationParameterInputs =
  (
    invocationParameters: JsonObjectSchema,
    modelSupportedInvocationParameters: InvocationParameter[]
  ): InvocationParameterInput[] => {
    return Object.entries(invocationParameters)
      .map(([key, value]) => {
        const invocationParameter = modelSupportedInvocationParameters.find(
          (mp) =>
            (mp.canonicalName &&
              mp.canonicalName.toLowerCase() === key.toLowerCase()) ||
            (mp.invocationName &&
              mp.invocationName.toLowerCase() === key.toLowerCase())
        );
        if (
          invocationParameter == null ||
          invocationParameter.invocationInputField == null ||
          invocationParameter.invocationName == null
        ) {
          return null;
        }
        return {
          canonicalName: invocationParameter.canonicalName,
          invocationName: invocationParameter.invocationName,
          [toCamelCase(invocationParameter.invocationInputField)]: value,
        };
      })
      .filter((ip): ip is NonNullable<typeof ip> => ip != null);
  };
export const getToolName = (tool: Tool): string | null => {
  const { provider, validatedToolDefinition } = detectToolDefinitionProvider(
    tool.definition
  );
  switch (provider) {
    case "OPENAI":
    case "AZURE_OPENAI":
      return validatedToolDefinition.function.name;
    case "ANTHROPIC":
      return validatedToolDefinition.name;
    case "UNKNOWN":
      return null;
    default:
      assertUnreachable(provider);
  }
};

/**
 * Creates a tool definition for the given provider
 * @param provider the provider to create the tool for
 * @param toolNumber the tool number to create - used for naming the tool
 * returns a tool definition for the given provider
 */
export const createToolForProvider = ({
  provider,
  toolNumber,
}: {
  provider: ModelProvider;
  toolNumber: number;
}): Tool => {
  switch (provider) {
    case "OPENAI":
    case "AZURE_OPENAI":
      return {
        id: generateToolId(),
        definition: createOpenAIToolDefinition(toolNumber),
      };
    case "ANTHROPIC":
      return {
        id: generateToolId(),
        definition: createAnthropicToolDefinition(toolNumber),
      };
    // TODO(apowell): #5348 Add Google tool definition
    case "GOOGLE":
      return {
        id: generateToolId(),
        definition: createOpenAIToolDefinition(toolNumber),
      };
    default:
      assertUnreachable(provider);
  }
};

/**
 * Creates a toolCall for the given provider
 * @param provider the provider to create the toolCall for
 * returns a toolCall for the given provider
 */
export const createToolCallForProvider = (
  provider: ModelProvider
): LlmProviderToolCall => {
  switch (provider) {
    case "OPENAI":
    case "AZURE_OPENAI":
      return createOpenAIToolCall();
    case "ANTHROPIC":
      return createAnthropicToolCall();
    // TODO(apowell): #5348 Add Google tool call
    case "GOOGLE":
      return createOpenAIToolCall();
    default:
      assertUnreachable(provider);
  }
};

/**
 * A utility function to convert playground messages content to GQL chat completion message input
 */
function toGqlChatCompletionMessage(
  message: ChatMessage
): ChatCompletionMessageInput {
  return {
    content: message.content,
    role: toGqlChatCompletionRole(message.role),
    toolCalls: message.toolCalls,
    toolCallId: message.toolCallId,
  };
}

function toGqlChatCompletionRole(
  role: ChatMessageRole
): ChatCompletionMessageRole {
  switch (role) {
    case "system":
      return "SYSTEM";
    case "user":
      return "USER";
    case "tool":
      return "TOOL";
    case "ai":
      return "AI";
    default:
      assertUnreachable(role);
  }
}

/**
 * Gets chat completion input for either running over a dataset or using variable input
 */
const getBaseChatCompletionInput = ({
  playgroundStore,
  instanceId,
  credentials,
}: {
  playgroundStore: PlaygroundStore;
  instanceId: number;
  credentials: CredentialsState;
}) => {
  // We pull directly from the store in this function so that it always has up to date values at the time of calling
  const { instances, allInstanceMessages } = playgroundStore.getState();
  const instance = instances.find((instance) => {
    return instance.id === instanceId;
  });

  if (!instance) {
    throw new Error(`No instance found for id ${instanceId}`);
  }
  if (instance.template.__type !== "chat") {
    throw new Error("We only support chat templates for now");
  }

  const instanceMessages = instance.template.messageIds
    .map((messageId) => {
      return allInstanceMessages[messageId];
    })
    .filter((message) => message != null);

  const supportedInvocationParameters =
    instance.model.supportedInvocationParameters;

  let invocationParameters: InvocationParameterInput[] = [
    ...instance.model.invocationParameters,
  ];
  const convertedToolChoice = safelyConvertToolChoiceToProvider({
    toolChoice: instance.toolChoice,
    targetProvider: instance.model.provider,
  });
  if (instance.tools.length > 0) {
    // ensure a single tool choice is added to the invocation parameters
    invocationParameters = invocationParameters.filter(
      (param) =>
        param.invocationName !== TOOL_CHOICE_PARAM_NAME &&
        param.canonicalName !== TOOL_CHOICE_PARAM_CANONICAL_NAME
    );
    invocationParameters.push({
      canonicalName: TOOL_CHOICE_PARAM_CANONICAL_NAME,
      invocationName: TOOL_CHOICE_PARAM_NAME,
      valueJson: convertedToolChoice,
    });
  } else {
    // remove tool choice if there are no tools
    invocationParameters = invocationParameters.filter(
      (param) =>
        param.invocationName !== TOOL_CHOICE_PARAM_NAME &&
        param.canonicalName !== TOOL_CHOICE_PARAM_CANONICAL_NAME
    );
  }
  // Filter invocation parameters to only include those that are supported by the model
  // This will remove configured values that are not supported by the newly selected model
  // If we don't have the list of supported invocation parameters in the store yet, we will just send
  // them all
  invocationParameters = supportedInvocationParameters.length
    ? constrainInvocationParameterInputsToDefinition(
        invocationParameters,
        supportedInvocationParameters
      )
    : invocationParameters;

  const azureModelParams =
    instance.model.provider === "AZURE_OPENAI"
      ? {
          endpoint: instance.model.endpoint,
          apiVersion: instance.model.apiVersion,
        }
      : {};

  return {
    messages: instanceMessages.map(toGqlChatCompletionMessage),
    model: {
      providerKey: instance.model.provider,
      name: instance.model.modelName || "",
      baseUrl: instance.model.baseUrl,
      ...azureModelParams,
    },
    invocationParameters: applyProviderInvocationParameterConstraints(
      invocationParameters,
      instance.model.provider,
      instance.model.modelName
    ),
    tools: instance.tools.length
      ? instance.tools.map((tool) => tool.definition)
      : undefined,
    apiKey: credentials[instance.model.provider] || null,
    promptName: instance.prompt?.name,
  } satisfies Partial<ChatCompletionInput>;
};

/**
 * Denormalize a playground instance with the actual messages
 *
 * A playground instance differs from a playground normalized instance in that it contains the actual messages
 * and not just the messageIds. This function will replace the messageIds with the actual messages.
 */
export const denormalizePlaygroundInstance = (
  instance: PlaygroundNormalizedInstance,
  allInstanceMessages: Record<number, ChatMessage>
): PlaygroundInstance => {
  if (instance.template.__type === "chat") {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { messageIds: _, ...rest } = instance.template;
    return {
      ...instance,
      template: {
        ...rest,
        messages: instance.template.messageIds.map(
          (messageId) => allInstanceMessages[messageId]
        ),
      },
    } satisfies PlaygroundInstance;
  }
  // it cannot be a normalized instance if it is not a chat template
  return instance as PlaygroundInstance;
};

/**
 * Gets chat completion input for running over variables
 */
export const getChatCompletionInput = ({
  playgroundStore,
  instanceId,
  credentials,
}: {
  playgroundStore: PlaygroundStore;
  instanceId: number;
  credentials: CredentialsState;
}): ChatCompletionInput => {
  const baseChatCompletionVariables = getBaseChatCompletionInput({
    playgroundStore,
    instanceId,
    credentials,
  });

  const {
    instances,
    templateFormat,
    input,
    allInstanceMessages: instanceMessages,
  } = playgroundStore.getState();

  // convert playgroundStateInstances to playgroundInstances
  const playgroundInstances = instances.map((instance) => {
    return denormalizePlaygroundInstance(instance, instanceMessages);
  });

  const { variablesMap } = getVariablesMapFromInstances({
    instances: playgroundInstances,
    input,
    templateFormat,
  });

  return {
    ...baseChatCompletionVariables,
    template: {
      variables: variablesMap,
      format: templateFormat,
    },
  };
};

/**
 * Gets chat completion input for running over a dataset
 */
export const getChatCompletionOverDatasetInput = ({
  playgroundStore,
  instanceId,
  credentials,
  datasetId,
}: {
  playgroundStore: PlaygroundStore;
  instanceId: number;
  credentials: CredentialsState;
  datasetId: string;
}): ChatCompletionOverDatasetInput => {
  const baseChatCompletionVariables = getBaseChatCompletionInput({
    playgroundStore,
    instanceId,
    credentials,
  });

  return {
    ...baseChatCompletionVariables,
    templateFormat: playgroundStore.getState().templateFormat,
    datasetId,
  };
};

/**
 * Given a playground chat message attribute value, returns a normalized json string.
 *
 * This string can then be passed into a JSON Editor.
 *
 * @param content - the content to normalize
 * @returns a normalized json string
 */
export function normalizeMessageContent(content?: unknown): string {
  if (typeof content === "string") {
    const isDoubleStringified =
      content.startsWith('"{') ||
      content.startsWith('"[') ||
      content.startsWith('"\\"');
    try {
      // If it's a double-stringified value, parse it twice
      if (isDoubleStringified) {
        // First parse removes the outer quotes and unescapes the inner content
        const firstParse = JSON.parse(content);
        // Second parse converts the string representation to actual JSON
        const secondParse =
          typeof firstParse === "string" ? JSON.parse(firstParse) : firstParse;
        // Stringify the result to ensure consistent formatting
        return JSON.stringify(secondParse, null, 2);
      }
    } catch {
      // If parsing fails, fall through
    }
    // If the content is a valid non-string top level json value, return it as-is
    // https://datatracker.ietf.org/doc/html/rfc7159#section-3
    // 0-9 { [ null false true
    // a regex that matches possible top level json values, besides strings
    const nonStringStart = /^\s*[0-9{[]|true|false|null/.test(content);
    if (nonStringStart) {
      return content;
    }
  }

  // For any content that doesn't match the json spec for a top level value, stringify it with pretty printing
  return JSON.stringify(content, null, 2);
}

export function areRequiredInvocationParametersConfigured(
  configuredInvocationParameters: InvocationParameterInput[],
  supportedInvocationParameters: InvocationParameter[]
) {
  return supportedInvocationParameters
    .filter((param) => param.required)
    .every((param) =>
      configuredInvocationParameters.some((ip) =>
        areInvocationParamsEqual(ip, param)
      )
    );
}

/**
 * Extracts the default value for the invocation parameter definition
 * And the key name that should be used in the invocation parameter input if we need to make a new one
 *
 * This logic is necessary because the default value is mapped to different key name based on its type
 * within the InvocationParameterInput queries in the playground e.g. floatDefaultValue or stringListDefaultValue
 */
const getInvocationParamDefaultValue = (
  param: InvocationParameter
): unknown => {
  for (const [key, value] of Object.entries(param)) {
    if (key.endsWith("DefaultValue") && value != null) {
      return param[key as keyof InvocationParameter];
    }
  }
  return undefined;
};

/**
 * Merges the current invocation parameters with the default values for the supported invocation parameters,
 * only adding values for invocation parameters that don't already have a value
 */
export function mergeInvocationParametersWithDefaults(
  invocationParameters: InvocationParameterInput[],
  supportedInvocationParameters: InvocationParameter[]
) {
  // Convert the current invocation parameters to a map for quick lookup
  const currentInvocationParametersMap = new Map(
    invocationParameters.map((param) => [param.invocationName, param])
  );
  supportedInvocationParameters.forEach((param) => {
    const paramKeyName = param.invocationName;
    // Extract the default value for the invocation parameter definition
    // And the key name that should be used in the invocation parameter input if we need to make a new one
    const defaultValue = getInvocationParamDefaultValue(param);
    // Convert the invocation input field to a key name that can be used in the invocation parameter input
    const invocationInputFieldKeyName = toCamelCase(
      param.invocationInputField || ""
    ) as keyof InvocationParameterInput;
    // Skip if we don't have required fields
    // or, if the current invocation parameter map already has a value for the key
    // so that we don't overwrite a user provided value, or a value saved to preferences
    if (
      !param.invocationName ||
      !param.invocationInputField ||
      !paramKeyName ||
      defaultValue == null ||
      currentInvocationParametersMap.get(paramKeyName)?.[
        invocationInputFieldKeyName
      ] != null
    ) {
      return;
    }
    // Create the new invocation parameter input, using the default value for the parameter
    const newInvocationParameter: InvocationParameterInput = {
      canonicalName: param.canonicalName,
      invocationName: param.invocationName,
      [invocationInputFieldKeyName]: defaultValue,
    };

    // Add the new invocation parameter input to the map
    currentInvocationParametersMap.set(paramKeyName, newInvocationParameter);
  });

  // Return the new invocation parameter inputs as an array
  return Array.from(currentInvocationParametersMap.values());
}

/**
 * Schema for validating if Anthropic extended thinking is enabled.
 */
const anthropicExtendedThinkingEnabledSchema = z
  .object({
    type: z.literal("enabled"),
  })
  .passthrough();

/**
 * Schema for validating Anthropic forced tool use.
 */
const anthropicForcedToolUseSchema = z
  .object({
    type: z.enum(["any", "tool"]),
  })
  .passthrough();

/**
 * Applies Anthropic-specific constraints to the invocation parameters.
 *
 * @param invocationParameters - The invocation parameters to be constrained.
 * @param model - The model name.
 * @returns The constrained invocation parameters.
 */
const applyAnthropicInvocationParameterConstraints = (
  invocationParameters: InvocationParameterInput[],
  model: string | null
): InvocationParameterInput[] => {
  if (!model) {
    return invocationParameters;
  }
  // First determine if extended thinking is enabled
  const hasExtendedThinking = invocationParameters.some(
    (param) =>
      param.canonicalName === "ANTHROPIC_EXTENDED_THINKING" &&
      param.valueJson &&
      anthropicExtendedThinkingEnabledSchema.safeParse(param.valueJson).success
  );
  // Filter parameters in a single pass
  return invocationParameters.filter((param) => {
    // Skip null/undefined valueJson for extended thinking
    if (
      param.canonicalName === "ANTHROPIC_EXTENDED_THINKING" &&
      !param.valueJson
    ) {
      return false;
    }
    // If extended thinking is enabled, apply specific constraints
    if (hasExtendedThinking) {
      // Remove temperature and top_p when extended thinking is enabled
      if (
        param.canonicalName === "TEMPERATURE" ||
        param.canonicalName === "TOP_P"
      ) {
        return false;
      }
      // Remove forced tool use because it's not compatible with extended thinking
      if (param.canonicalName === TOOL_CHOICE_PARAM_CANONICAL_NAME) {
        return !anthropicForcedToolUseSchema.safeParse(param.valueJson).success;
      }
    }
    // Keep all other parameters
    return true;
  });
};

/**
 * Applies provider-specific constraints to the invocation parameters.
 *
 * @param invocationParameters - The invocation parameters to be constrained.
 * @param provider - The provider of the model.
 * @param model - The model name.
 * @returns The constrained invocation parameters.
 */
export const applyProviderInvocationParameterConstraints = (
  invocationParameters: InvocationParameterInput[],
  provider: ModelProvider,
  model: string | null
): InvocationParameterInput[] => {
  if (provider === "ANTHROPIC") {
    return applyAnthropicInvocationParameterConstraints(
      invocationParameters,
      model
    );
  }
  return invocationParameters;
};
