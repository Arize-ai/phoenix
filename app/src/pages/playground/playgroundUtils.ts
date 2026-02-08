import { z } from "zod";

import { TemplateFormats } from "@phoenix/components/templateEditor/constants";
import { getTemplateFormatUtils } from "@phoenix/components/templateEditor/templateEditorUtils";
import { TemplateFormat } from "@phoenix/components/templateEditor/types";
import {
  ChatRoleMap,
  DEFAULT_CHAT_ROLE,
  DEFAULT_MODEL_PROVIDER,
  ProviderToCredentialsConfigMap,
} from "@phoenix/constants/generativeConstants";
import {
  createAnthropicToolDefinition,
  createAwsToolDefinition,
  createGeminiToolDefinition,
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
import { CredentialsState } from "@phoenix/store/credentialsStore";
import {
  ChatMessage,
  createNormalizedPlaygroundInstance,
  generateMessageId,
  generateToolId,
  ModelConfig,
  ModelInvocationParameterInput,
  PlaygroundInput,
  PlaygroundInstance,
  PlaygroundNormalizedInstance,
  PlaygroundStore,
  Tool,
} from "@phoenix/store/playground";
import {
  assertUnreachable,
  isStringKeyedObject,
  Mutable,
} from "@phoenix/typeUtils";
import {
  formatContentAsString,
  safelyParseJSON,
} from "@phoenix/utils/jsonUtils";

import { ChatCompletionOverDatasetInput } from "./__generated__/PlaygroundDatasetExamplesTableSubscription.graphql";
import {
  ChatCompletionInput,
  ChatCompletionMessageInput,
  ChatCompletionMessageRole,
  GenerativeCredentialInput,
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
        case "DEEPSEEK":
        case "XAI":
        case "PERPLEXITY":
        case "AWS":
        case "OLLAMA":
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
  const maybeProvider = provider.toLowerCase();
  switch (maybeProvider) {
    case "openai":
      return "OPENAI";
    case "anthropic":
      return "ANTHROPIC";
    case "aws":
      return "AWS";
    case "google":
      return "GOOGLE";
    case "azure":
      return "AZURE_OPENAI";
    case "perplexity":
      return "PERPLEXITY";
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
    const { baseUrl } = getUrlInfoFromAttributes(parsedAttributes);
    const azureConfig =
      provider === "AZURE_OPENAI"
        ? getAzureConfigFromAttributes(parsedAttributes)
        : { deploymentName: null, apiVersion: null, endpoint: null };
    const modelName =
      provider === "AZURE_OPENAI" && azureConfig.deploymentName
        ? azureConfig.deploymentName
        : data.llm.model_name;
    return {
      modelConfig: {
        ...Object.fromEntries(
          Object.entries({
            baseUrl,
            endpoint: azureConfig.endpoint,
            apiVersion: azureConfig.apiVersion,
          }).filter(([_, value]) => value !== null)
        ),
        modelName,
        provider,
        invocationParameters: [],
        supportedInvocationParameters: [],
      },
      parsingErrors: [],
    };
  }
  return { modelConfig: null, parsingErrors: [MODEL_CONFIG_PARSING_ERROR] };
}

/**
 * Temporary stopgap: Extract Azure config (deploymentName, apiVersion, endpoint)
 * from span attributes until vendor-specific OpenInference conventions exist.
 *
 * Important: This currently only works for two types of spans:
 * - Phoenix playground spans (URL present → parsed for deployment/apiVersion/endpoint)
 * - LangChain spans (metadata.ls_model_name)
 *
 * Note: For Azure, `llm.model_name` is NOT the deployment name.
 *
 * Where we look (in order of precedence):
 * 1) URL (preferred): When the request URL is present (most often on playground
 *    generated spans), parse it to extract:
 *    - deploymentName from the path segment: deployments/<name>/...
 *    - apiVersion from the query param: api-version=<version>
 *    - endpoint from the URL origin
 * 2) Metadata (fallback): If the URL is not present or not parseable, use
 *    `llm.metadata.ls_model_name` (commonly emitted by some LangChain spans) as
 *    the deploymentName.
 *
 * Notes:
 * - URL is typically only included for spans emitted by the Phoenix playground;
 *   external OpenTelemetry spans may not include it, so we rely on metadata
 *   when necessary.
 * - This is a temporary stopgap until vendor-specific OpenInference conventions
 *   exist for Azure configuration. We cannot reliably detect LangChain emitters.
 */
export function getAzureConfigFromAttributes(parsedAttributes: unknown): {
  deploymentName: string | null;
  apiVersion: string | null;
  endpoint: string | null;
} {
  const { success: metaSuccess, data: meta } =
    LS_METADATA_SCHEMA.safeParse(parsedAttributes);
  const deploymentNameFromMetadata =
    metaSuccess &&
    typeof meta?.metadata?.ls_model_name === "string" &&
    meta.metadata.ls_model_name.trim()
      ? meta.metadata.ls_model_name.trim()
      : null;
  // Derive deployment name, endpoint and apiVersion from URL when available
  const { success: urlSuccess, data: urlData } =
    urlSchema.safeParse(parsedAttributes);
  const { endpoint, apiVersion, deploymentName } = urlSuccess
    ? parseAzureDeploymentInfoFromUrl(urlData.url.full)
    : { endpoint: null, apiVersion: null, deploymentName: null };
  return {
    // URL takes precedence when present; fall back to metadata-derived name
    deploymentName: deploymentName ?? deploymentNameFromMetadata,
    apiVersion,
    endpoint,
  };
}

export function getUrlInfoFromAttributes(parsedAttributes: unknown): {
  baseUrl: string | null;
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
      };
    } catch (_) {
      // If the URL is invalid, we will just return null for all values
    }
  }
  return {
    baseUrl: null,
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
        repetitions: {
          1: {
            output: null,
            spanId: span.id,
            error: null,
            toolCalls: {},
            status: "notStarted",
          },
        },
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
          ? formatContentAsString(message.content)
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
      repetitions: {
        ...basePlaygroundInstance.repetitions,
        ...{
          1: {
            output: output ?? null,
            spanId: span.id,
            error: null,
            toolCalls: {}, // when parsed from span attributes, tool calls are contained in the output
            status: "finished",
          },
        },
      },
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
    case "AWS":
      return validatedToolDefinition.toolSpec.name;
    case "GOOGLE":
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
    case "DEEPSEEK":
    case "XAI":
    case "PERPLEXITY":
    case "OLLAMA":
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
    case "AWS":
      return {
        id: generateToolId(),
        definition: createAwsToolDefinition(toolNumber),
      };
    case "GOOGLE":
      return {
        id: generateToolId(),
        definition: createGeminiToolDefinition(toolNumber),
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
    case "DEEPSEEK":
    case "XAI":
    case "PERPLEXITY":
    case "AWS":
    case "OLLAMA":
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
 * Normalizes invocation parameters by removing unset float values or invalid float values
 * @param invocationParameters - the invocation parameters to normalize
 * @returns the normalized invocation parameters
 */
export const normalizeInvocationParameters = (
  invocationParameters: ModelInvocationParameterInput[]
): InvocationParameterInput[] => {
  return invocationParameters
    .filter((param) => {
      // Remove unset float values or invalid float values
      if (
        param.valueFloat !== null &&
        typeof param.valueFloat === "number" &&
        isNaN(param.valueFloat)
      ) {
        return false;
      }
      return true;
    })
    .map(({ dirty: _dirty, ...param }) => {
      return param;
    });
};

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

  let invocationParameters: InvocationParameterInput[] =
    normalizeInvocationParameters(instance.model.invocationParameters);
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

  const awsModelParams =
    instance.model.provider === "AWS"
      ? {
          region: instance.model.region,
        }
      : {};

  return {
    messages: instanceMessages.map(toGqlChatCompletionMessage),
    model: {
      providerKey: instance.model.provider,
      name: instance.model.modelName || "",
      baseUrl: instance.model.baseUrl,
      customHeaders: instance.model.customHeaders,
      ...azureModelParams,
      ...awsModelParams,
    },
    invocationParameters: applyProviderInvocationParameterConstraints(
      invocationParameters,
      instance.model.provider,
      instance.model.modelName
    ),
    tools: instance.tools.length
      ? instance.tools.map((tool) => tool.definition)
      : undefined,
    credentials: getCredentials(credentials, instance.model.provider),
    promptName: instance.prompt?.name,
    repetitions: playgroundStore.getState().repetitions,
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
 * A function that gets the credentials for a provider
 */
function getCredentials(
  credentials: CredentialsState,
  provider: ModelProvider
): GenerativeCredentialInput[] {
  const providerCredentials = credentials[provider];
  const providerCredentialsConfig = ProviderToCredentialsConfigMap[provider];
  if (!providerCredentials) {
    // This means the credentials are missing, however we don't want to throw here so we return an empty array
    return [];
  }
  if (providerCredentialsConfig.length === 0) {
    // This means that the provider doesn't require any credentials
    return [];
  }
  return providerCredentialsConfig.map((credential) => ({
    envVarName: credential.envVarName,
    value: providerCredentials[credential.envVarName] ?? "",
  }));
}

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
  splitIds,
}: {
  playgroundStore: PlaygroundStore;
  instanceId: number;
  credentials: CredentialsState;
  datasetId: string;
  splitIds?: string[];
}): ChatCompletionOverDatasetInput => {
  const baseChatCompletionVariables = getBaseChatCompletionInput({
    playgroundStore,
    instanceId,
    credentials,
  });

  return {
    ...baseChatCompletionVariables,
    templateFormat: playgroundStore.getState().templateFormat,
    repetitions: playgroundStore.getState().repetitions,
    datasetId,
    splitIds: splitIds ?? null,
  };
};

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

const ZERO_VALUE_INVOCATION_NAMES = ["frequency_penalty", "presence_penalty"];

/**
 * A function that filters out invocation parameters where 0 and null have the same effect
 * For these parameters, we can omit the 0 value because it's the same as null
 * @param invocationParameters
 * @returns
 */
const filterZeroValueInvocationParameters = (
  invocationParameters: InvocationParameterInput[]
): InvocationParameterInput[] => {
  const filtered = invocationParameters.filter((param) => {
    if (
      param.invocationName &&
      ZERO_VALUE_INVOCATION_NAMES.includes(param.invocationName)
    ) {
      return !(param.valueFloat == 0 || param.valueInt == 0);
    }
    return true;
  });
  return filtered;
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
  // We want to remove 0 values for parameters where 0 and null have the same effect
  const filteredInvocationParameters =
    filterZeroValueInvocationParameters(invocationParameters);
  if (provider === "ANTHROPIC") {
    return applyAnthropicInvocationParameterConstraints(
      filteredInvocationParameters,
      model
    );
  }
  return filteredInvocationParameters;
};

// --- Azure helpers (module-level) --------------------------------------------------------------
// Regex to extract deployment name from a path like: deployments/<name>/chat/completions
const AZURE_DEPLOYMENT_PATH_REGEX = /(?:^|\/)deployments\/([^/]+)(?:\/?|$)/;

// Optional schema to read LangChain-provided deployment name from metadata
const LS_METADATA_SCHEMA = z
  .object({
    metadata: z
      .object({
        ls_model_name: z.string().optional(),
      })
      .optional(),
  })
  .passthrough();

// Parse Azure details (endpoint, apiVersion, deployment name) from URL
function parseAzureDeploymentInfoFromUrl(fullUrl: string): {
  endpoint: string | null;
  apiVersion: string | null;
  deploymentName: string | null;
} {
  try {
    const urlObj = new URL(fullUrl);
    const endpoint = urlObj.origin.trim();
    const apiVer = urlObj.searchParams.get("api-version");
    const apiVersion = apiVer && apiVer.trim() ? apiVer.trim() : null;
    const path = (urlObj.pathname || "").toString();
    const match = path.match(AZURE_DEPLOYMENT_PATH_REGEX);
    const deploymentName = match && match[1] ? match[1].trim() : null;
    return { endpoint, apiVersion, deploymentName };
  } catch {
    return { endpoint: null, apiVersion: null, deploymentName: null };
  }
}
