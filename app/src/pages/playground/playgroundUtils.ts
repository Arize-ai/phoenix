import { z } from "zod";

import { TemplateFormats } from "@phoenix/components/templateEditor/constants";
import { getTemplateFormatUtils } from "@phoenix/components/templateEditor/templateEditorUtils";
import type { TemplateFormat } from "@phoenix/components/templateEditor/types";
import {
  ChatRoleMap,
  DEFAULT_CHAT_ROLE,
  DEFAULT_MODEL_PROVIDER,
  DEFAULT_OPENAI_API_TYPE,
  ProviderToCredentialsConfigMap,
} from "@phoenix/constants/generativeConstants";
import {
  anthropicToolDefinitionSchema,
  awsToolDefinitionSchema,
  geminiToolDefinitionSchema,
  openAIResponsesToolDefinitionSchema,
  openAIToolDefinitionSchema,
} from "@phoenix/schemas";
import type { JSONLiteral } from "@phoenix/schemas/jsonLiteralSchema";
import type { PhoenixToolEditorType } from "@phoenix/schemas/phoenixToolTypeSchemas";
import type {
  AnthropicToolCall,
  LlmProviderToolCall,
  OpenAIToolCall,
} from "@phoenix/schemas/toolCallSchemas";
import {
  createAnthropicToolCall,
  createOpenAIToolCall,
  findToolCallArguments,
  findToolCallId,
  findToolCallName,
} from "@phoenix/schemas/toolCallSchemas";
import {
  anthropicToolChoiceSchema,
  awsToolChoiceSchema,
  googleToolChoiceSchema,
  openAIToolChoiceSchema,
  rawToolChoiceFromInvocationParametersSchema,
} from "@phoenix/schemas/toolChoiceSchemas";
import type { CredentialsState } from "@phoenix/store/credentialsStore";
import type {
  CanonicalResponseFormat,
  CanonicalToolChoice,
  CanonicalToolDefinition,
  ChatMessage,
  ModelConfig,
  ModelInvocationParameterInput,
  PlaygroundInput,
  PlaygroundInstance,
  PlaygroundNormalizedInstance,
  PlaygroundStore,
  Tool,
} from "@phoenix/store/playground";
import {
  createNormalizedPlaygroundInstance,
  generateMessageId,
  generateToolId,
} from "@phoenix/store/playground";
import type { Mutable } from "@phoenix/typeUtils";
import { assertUnreachable, isStringKeyedObject } from "@phoenix/typeUtils";
import {
  formatContentAsString,
  safelyParseJSON,
} from "@phoenix/utils/jsonUtils";

import type { InvocationParameter } from "../../components/playground/model/InvocationParametersFormFields";
import type {
  ChatCompletionOverDatasetInput,
  EvaluatorInputMappingInput,
} from "./__generated__/PlaygroundDatasetExamplesTableSubscription.graphql";
import type {
  ChatCompletionInput,
  GenerativeCredentialInput,
  PromptMessageRole,
} from "./__generated__/PlaygroundOutputSubscription.graphql";
import type { ChatPromptVersionInput } from "./__generated__/UpsertPromptFromTemplateDialogCreateMutation.graphql";
import {
  INPUT_MESSAGES_PARSING_ERROR,
  MODEL_CONFIG_PARSING_ERROR,
  MODEL_CONFIG_WITH_INVOCATION_PARAMETERS_PARSING_ERROR,
  MODEL_CONFIG_WITH_RESPONSE_FORMAT_PARSING_ERROR,
  modelProviderToModelPrefixMap,
  OUTPUT_MESSAGES_PARSING_ERROR,
  OUTPUT_VALUE_PARSING_ERROR,
  PROMPT_TEMPLATE_VARIABLES_PARSING_ERROR,
  SPAN_ATTRIBUTES_PARSING_ERROR,
  TOOLS_PARSING_ERROR,
} from "./constants";
import type { InvocationParameterInput } from "./invocationParameterUtils";
import {
  areInvocationParamsEqual,
  constrainInvocationParameterInputsToDefinition,
  toCamelCase,
} from "./invocationParameterUtils";
import type { JsonObjectSchema, LlmToolSchema, MessageSchema } from "./schemas";
import {
  chatMessageRolesSchema,
  chatMessagesSchema,
  llmInputMessageSchema,
  llmOutputMessageSchema,
  llmToolSchema,
  modelConfigSchema,
  modelConfigWithAnthropicOutputConfigSchema,
  modelConfigWithGoogleResponseFormatSchema,
  modelConfigWithInvocationParametersSchema,
  modelConfigWithOpenAIResponsesFormatSchema,
  modelConfigWithResponseFormatSchema,
  outputSchema,
  promptTemplateSchema,
  urlSchema,
} from "./schemas";
import type { PlaygroundSpan } from "./spanPlaygroundPageLoader";

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
        case "AWS":
        case "OLLAMA":
        case "CEREBRAS":
        case "FIREWORKS":
        case "GROQ":
        case "MOONSHOT":
        case "PERPLEXITY":
        case "TOGETHER":
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
        : { deploymentName: null, endpoint: null };
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
 * Temporary stopgap: Extract Azure config (deploymentName, endpoint)
 * from span attributes until vendor-specific OpenInference conventions exist.
 *
 * Important: This currently only works for two types of spans:
 * - Phoenix playground spans (URL present → parsed for deployment/endpoint)
 * - LangChain spans (metadata.ls_model_name)
 *
 * Note: For Azure, `llm.model_name` is NOT the deployment name.
 *
 * Where we look (in order of precedence):
 * 1) URL (preferred): When the request URL is present (most often on playground
 *    generated spans), parse it to extract:
 *    - deploymentName from the path segment: deployments/<name>/...
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
  // Derive deployment name and endpoint from URL when available
  const { success: urlSuccess, data: urlData } =
    urlSchema.safeParse(parsedAttributes);
  const { endpoint, deploymentName } = urlSuccess
    ? parseAzureDeploymentInfoFromUrl(urlData.url.full)
    : { endpoint: null, deploymentName: null };
  return {
    // URL takes precedence when present; fall back to metadata-derived name
    deploymentName: deploymentName ?? deploymentNameFromMetadata,
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

/**
 * Converts a raw provider-specific tool_choice value (from a span's
 * llm.invocation_parameters) directly to a CanonicalToolChoice.
 *
 * Each provider schema is tried in order; the first match wins.
 * No intermediate pivot through OpenAI format — hub-and-spoke all the way.
 */
function rawSpanToolChoiceToCanonical(
  raw: unknown
): CanonicalToolChoice | null {
  // OpenAI / OpenAI-compatible: strings or typed objects
  const openai = openAIToolChoiceSchema.safeParse(raw);
  if (openai.success) {
    const c = openai.data;
    if (c === "none") return { type: "NONE" };
    if (c === "auto") return { type: "ZERO_OR_MORE" };
    if (c === "required") return { type: "ONE_OR_MORE" };
    if (c.type === "function")
      return { type: "SPECIFIC_FUNCTION", functionName: c.function.name };
    if (c.type === "allowed_tools")
      return c.allowed_tools.mode === "required"
        ? { type: "ONE_OR_MORE" }
        : { type: "ZERO_OR_MORE" };
    if (c.type === "custom")
      return { type: "SPECIFIC_FUNCTION", functionName: c.custom.name };
  }

  // Anthropic: { type: "none"|"auto"|"any"|"tool", name?, disable_parallel_tool_use? }
  const anthropic = anthropicToolChoiceSchema.safeParse(raw);
  if (anthropic.success) {
    const c = anthropic.data;
    switch (c.type) {
      case "none":
        return { type: "NONE" };
      case "auto":
        return { type: "ZERO_OR_MORE" };
      case "any":
        return { type: "ONE_OR_MORE" };
      case "tool":
        return { type: "SPECIFIC_FUNCTION", functionName: c.name };
    }
  }

  // Google: { function_calling_config: { mode, allowed_function_names? } }
  const google = googleToolChoiceSchema.safeParse(raw);
  if (google.success) {
    const { mode, allowed_function_names } =
      google.data.function_calling_config;
    if (allowed_function_names?.length === 1)
      return {
        type: "SPECIFIC_FUNCTION",
        functionName: allowed_function_names[0],
      };
    switch (mode) {
      case "none":
        return { type: "NONE" };
      case "auto":
      case "mode_unspecified":
        return { type: "ZERO_OR_MORE" };
      case "any":
      case "validated":
        return { type: "ONE_OR_MORE" };
    }
  }

  // AWS Bedrock: { auto: {} } | { any: {} } | { tool: { name } }
  const aws = awsToolChoiceSchema.safeParse(raw);
  if (aws.success) {
    const c = aws.data;
    if ("tool" in c && c.tool)
      return { type: "SPECIFIC_FUNCTION", functionName: c.tool.name };
    if ("any" in c && c.any) return { type: "ONE_OR_MORE" };
    if ("auto" in c && c.auto) return { type: "ZERO_OR_MORE" };
  }

  return null;
}

/**
 * Extracts tool choice from span attributes (llm.invocation_parameters).
 * Uses Zod schemas for provider-specific shapes: tool_choice (OpenAI/Anthropic),
 * tool_config (Google), toolConfig.toolChoice (AWS). Returns undefined if no
 * tool choice is present or the value is unrecognised.
 *
 * Handles invocation_parameters as either a JSON string (from span/API) or an
 * already-parsed object.
 */
export function getToolChoiceFromAttributes(
  parsedAttributes: unknown
): CanonicalToolChoice | undefined {
  const llm = (parsedAttributes as Record<string, unknown> | null)?.llm;
  const rawInvParams =
    llm != null && typeof llm === "object"
      ? (llm as Record<string, unknown>).invocation_parameters
      : undefined;
  if (rawInvParams == null) {
    return undefined;
  }
  const invParams: Record<string, unknown> | null =
    typeof rawInvParams === "string"
      ? (() => {
          const { json } = safelyParseJSON(rawInvParams);
          return isStringKeyedObject(json) ? json : null;
        })()
      : isStringKeyedObject(rawInvParams)
        ? rawInvParams
        : null;
  if (invParams == null) {
    return undefined;
  }
  const parsed =
    rawToolChoiceFromInvocationParametersSchema.safeParse(invParams);
  if (!parsed.success || parsed.data === undefined) {
    return undefined;
  }
  return rawSpanToolChoiceToCanonical(parsed.data) ?? undefined;
}

export function getResponseFormatFromAttributes(
  parsedAttributes: unknown,
  provider?: ModelProvider
): {
  responseFormat: CanonicalResponseFormat | undefined;
  parsingErrors: string[];
} {
  if (provider === "ANTHROPIC") {
    const { success, data } =
      modelConfigWithAnthropicOutputConfigSchema.safeParse(parsedAttributes);
    if (!success) {
      return { responseFormat: undefined, parsingErrors: [] };
    }
    const format = data.llm.invocation_parameters.output_config?.format;
    if (!format) {
      return { responseFormat: undefined, parsingErrors: [] };
    }
    return {
      responseFormat: {
        type: "json_schema",
        jsonSchema: { name: "response", schema: format.schema },
      },
      parsingErrors: [],
    };
  }

  if (provider === "GOOGLE") {
    const { success, data } =
      modelConfigWithGoogleResponseFormatSchema.safeParse(parsedAttributes);
    if (!success) {
      return { responseFormat: undefined, parsingErrors: [] };
    }
    const { response_json_schema, response_schema, response_mime_type } =
      data.llm.invocation_parameters;
    const schema = response_json_schema ?? response_schema;
    if (!schema || response_mime_type !== "application/json") {
      return { responseFormat: undefined, parsingErrors: [] };
    }
    return {
      responseFormat: {
        type: "json_schema",
        jsonSchema: { name: "response", schema },
      },
      parsingErrors: [],
    };
  }

  // AWS Bedrock: outputConfig.textFormat.structure.jsonSchema with schema as JSON string
  if (provider === "AWS") {
    const llm = (parsedAttributes as Record<string, unknown>)?.llm;
    const rawInv =
      llm != null && typeof llm === "object"
        ? (llm as Record<string, unknown>).invocation_parameters
        : undefined;
    const invParams: Record<string, unknown> | null =
      rawInv == null
        ? null
        : typeof rawInv === "string"
          ? (() => {
              const { json } = safelyParseJSON(rawInv);
              return isStringKeyedObject(json) ? json : null;
            })()
          : isStringKeyedObject(rawInv)
            ? rawInv
            : null;
    const jsonSchema = invParams?.outputConfig as
      | {
          textFormat?: {
            structure?: {
              jsonSchema?: {
                schema?: string | object;
                name?: string;
                description?: string;
              };
            };
          };
        }
      | undefined;
    const js = jsonSchema?.textFormat?.structure?.jsonSchema;
    if (!js) {
      return { responseFormat: undefined, parsingErrors: [] };
    }
    const rawSchema = js.schema;
    const schemaObj: object | null =
      rawSchema == null
        ? null
        : typeof rawSchema === "string"
          ? (() => {
              const { json } = safelyParseJSON(rawSchema);
              return json != null &&
                typeof json === "object" &&
                !Array.isArray(json)
                ? (json as object)
                : null;
            })()
          : typeof rawSchema === "object" &&
              rawSchema !== null &&
              !Array.isArray(rawSchema)
            ? (rawSchema as object)
            : null;
    if (!schemaObj) {
      return { responseFormat: undefined, parsingErrors: [] };
    }
    return {
      responseFormat: {
        type: "json_schema",
        jsonSchema: {
          name: typeof js.name === "string" ? js.name : "response",
          schema: schemaObj,
          ...(typeof js.description === "string" && {
            description: js.description,
          }),
        },
      },
      parsingErrors: [],
    };
  }

  // Try Chat Completions shape: invocation_parameters.response_format.
  // Schema SUCCESS means the format is either absent (optional) or well-formed.
  // Schema FAILURE means the field was present but malformed.
  const { success: ccSuccess, data: ccData } =
    modelConfigWithResponseFormatSchema.safeParse(parsedAttributes);
  if (ccSuccess) {
    const rf = ccData.llm.invocation_parameters.response_format as
      | {
          type?: string;
          json_schema?: {
            name?: string;
            schema?: unknown;
            strict?: boolean | null;
            description?: string | null;
          };
        }
      | undefined;
    if (rf?.json_schema) {
      return {
        responseFormat: {
          type: "json_schema",
          jsonSchema: {
            name: rf.json_schema.name ?? "response",
            ...(rf.json_schema.schema !== undefined && {
              schema: rf.json_schema.schema,
            }),
            ...(rf.json_schema.strict !== undefined && {
              strict: rf.json_schema.strict,
            }),
            ...(rf.json_schema.description !== undefined && {
              description: rf.json_schema.description,
            }),
          },
        },
        parsingErrors: [],
      };
    }
    // response_format absent — try Responses API (text.format) before giving up
    const { success: respSuccess, data: respData } =
      modelConfigWithOpenAIResponsesFormatSchema.safeParse(parsedAttributes);
    if (respSuccess && respData.llm.invocation_parameters.text?.format) {
      const fmt = respData.llm.invocation_parameters.text.format as {
        type?: string;
        name?: string;
        schema?: unknown;
        strict?: boolean;
        description?: string;
      };
      return {
        responseFormat: {
          type: "json_schema",
          jsonSchema: {
            name: fmt.name ?? "response",
            ...(fmt.schema !== undefined && { schema: fmt.schema }),
            ...(fmt.strict !== undefined && { strict: fmt.strict }),
            ...(fmt.description !== undefined && {
              description: fmt.description,
            }),
          },
        },
        parsingErrors: [],
      };
    }
    // Neither format present — not an error, just no response format
    return { responseFormat: undefined, parsingErrors: [] };
  }

  // CC schema failed — response_format was present but malformed
  return {
    responseFormat: undefined,
    parsingErrors: [MODEL_CONFIG_WITH_RESPONSE_FORMAT_PARSING_ERROR],
  };
}

/**
 * Processes the tools from the span attributes to be used in the playground.
 * Provider-specific formats (Gemini, Anthropic, AWS, etc.) are preserved as-is.
 * OpenAI Responses API tools are normalized to Chat Completions format since
 * the playground only supports Chat Completions tools for now.
 * @param tools tools from the span attributes
 * @returns playground tools
 */
function processAttributeTools(tools: LlmToolSchema): Tool[] {
  return (tools?.llm?.tools ?? [])
    .map((tool) => {
      if (tool?.tool == null) {
        return null;
      }
      const rawDefinition = tool.tool.json_schema;
      // Normalize to canonical hub form (OpenAI Responses API → Chat Completions
      // is handled transparently by toCanonicalToolDefinition).
      const definition = toCanonicalToolDefinition(rawDefinition);
      if (definition == null) {
        return null;
      }
      return {
        id: generateToolId(),
        editorType: "json",
        definition,
      } satisfies Tool;
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
  const spanProvider =
    modelConfig?.provider ?? basePlaygroundInstance.model.provider;

  // parse response format separately so that we can get distinct error messages from the rest of
  // the invocation parameters
  const {
    responseFormat: spanResponseFormat,
    parsingErrors: responseFormatParsingErrors,
  } = getResponseFormatFromAttributes(parsedAttributes, spanProvider);

  // Extract tool choice from invocation parameters (promoted to instance.toolChoice)
  const spanToolChoice = getToolChoiceFromAttributes(parsedAttributes);

  // Merge invocation parameters into model config, if model config is present
  modelConfig =
    modelConfig != null
      ? {
          ...modelConfig,
          // Store canonical response format directly on the model when present
          ...(spanResponseFormat != null &&
          responseFormatParsingErrors.length === 0
            ? { responseFormat: spanResponseFormat }
            : {}),
          invocationParameters: invocationParameters.filter(
            (param) =>
              // All providers: strip tool_choice (promoted to instance.toolChoice)
              param.invocationName !== "tool_choice" &&
              // Anthropic: strip output_config (promoted to responseFormat)
              (spanProvider !== "ANTHROPIC" ||
                param.invocationName !== "output_config") &&
              // AWS: strip outputConfig (promoted to responseFormat)
              (spanProvider !== "AWS" ||
                param.invocationName !== "outputConfig") &&
              // Google: strip response_json_schema / response_schema / response_mime_type
              (spanProvider !== "GOOGLE" ||
                (param.invocationName !== "response_json_schema" &&
                  param.invocationName !== "response_schema" &&
                  param.invocationName !== "response_mime_type")) &&
              // OpenAI Responses API: strip text (promoted via text.format)
              ((spanProvider !== "OPENAI" && spanProvider !== "AZURE_OPENAI") ||
                param.invocationName !== "text")
          ),
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
      ...(spanToolChoice != null ? { toolChoice: spanToolChoice } : {}),
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
  if (templateFormat === TemplateFormats.NONE) {
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
  if (templateFormat === TemplateFormats.NONE) {
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

/**
 * Extracts the root variable name from a path expression.
 *
 * @example
 * extractRootVariable("reference.label") // => "reference"
 * extractRootVariable("user.address.city") // => "user"
 * extractRootVariable("items[0].name") // => "items"
 * extractRootVariable("simple") // => "simple"
 */
export const extractRootVariable = (path: string): string => {
  const match = path.match(/^([^.[\]]+)/);
  return match ? match[1] : path;
};

/**
 * Extracts the root variable names from a list of paths.
 * Returns unique root variable names.
 */
export const extractRootVariables = (paths: string[]): string[] => {
  return Array.from(new Set(paths.map(extractRootVariable)));
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
  if (templateFormat === TemplateFormats.NONE) {
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
  return tool.definition?.name ?? null;
};

/**
 * Creates a tool definition for the given provider
 * @param provider the provider to create the tool for
 * @param toolNumber the tool number to create - used for naming the tool
 * @param type the type of the tool
 * @param definition the definition of the tool. In OpenAI format, will be converted to the appropriate format for the provider.
 * @returns a tool definition for the given provider
 */
/** Default canonical tool definition used when adding a new tool (provider-agnostic). */
function getDefaultCanonicalToolDefinition(
  toolNumber: number
): CanonicalToolDefinition {
  return {
    name: `new_function_${toolNumber}`,
    description: "a description",
    parameters: {
      type: "object",
      properties: { new_arg: { type: "string" } },
      required: [],
    },
    strict: null,
  };
}

/**
 * Creates a canonical tool definition (hub-and-spoke: canonical in store,
 * provider-specific format rendered at display boundary by getToolDefinitionDisplay).
 */
export const createTool = ({
  toolNumber,
  type = "json",
  definition,
}: {
  toolNumber: number;
  type?: PhoenixToolEditorType;
  definition?: CanonicalToolDefinition;
}): Tool => {
  const defaultDefinition: CanonicalToolDefinition =
    definition ?? getDefaultCanonicalToolDefinition(toolNumber);

  return {
    id: generateToolId(),
    editorType: type,
    definition: defaultDefinition,
  };
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
    case "AWS":
    case "OLLAMA":
    case "CEREBRAS":
    case "FIREWORKS":
    case "GROQ":
    case "MOONSHOT":
    case "PERPLEXITY":
    case "TOGETHER":
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
  const { instances } = playgroundStore.getState();
  const instance = instances.find((instance) => {
    return instance.id === instanceId;
  });

  if (!instance) {
    throw new Error(`No instance found for id ${instanceId}`);
  }
  if (instance.template.__type !== "chat") {
    throw new Error("We only support chat templates for now");
  }

  const supportedInvocationParameters =
    instance.model.supportedInvocationParameters;

  let invocationParameters: InvocationParameterInput[] =
    normalizeInvocationParameters(instance.model.invocationParameters);
  // Filter invocation parameters to only include those that are supported by the model
  // This will remove configured values that are not supported by the newly selected model
  // If we don't have the list of supported invocation parameters in the store yet, we will just send
  // them all.
  if (supportedInvocationParameters.length) {
    invocationParameters = constrainInvocationParameterInputsToDefinition(
      invocationParameters,
      supportedInvocationParameters
    );
  }

  const azureModelParams =
    instance.model.provider === "AZURE_OPENAI"
      ? {
          endpoint: instance.model.endpoint,
        }
      : {};

  const awsModelParams =
    instance.model.provider === "AWS"
      ? {
          region: instance.model.region,
        }
      : {};

  // Determine if we're using a custom provider or built-in provider
  const customProvider = instance.model.customProvider;

  const openaiApiTypeParams =
    instance.model.provider === "OPENAI" ||
    instance.model.provider === "AZURE_OPENAI"
      ? {
          openaiApiType:
            instance.model.openaiApiType ?? DEFAULT_OPENAI_API_TYPE,
        }
      : {};

  const clientOptions = customProvider
    ? {
        custom: {
          extraHeaders: instance.model.customHeaders,
        },
      }
    : {
        builtin: {
          baseUrl: instance.model.baseUrl,
          customHeaders: instance.model.customHeaders,
          ...openaiApiTypeParams,
          ...azureModelParams,
          ...awsModelParams,
        },
      };

  return {
    clientOptions,
    credentials: toGqlCredentials(credentials),
    invocationParameters: applyProviderInvocationParameterConstraints(
      invocationParameters,
      instance.model.provider,
      instance.model.modelName
    ),
    promptName: instance.prompt?.name,
    repetitions: playgroundStore.getState().repetitions,
  };
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
 * Transforms credentials state into GraphQL input format.
 * Collects all non-empty credentials from all providers for API calls.
 * This is needed because evaluators may use different providers than the prompt.
 */
export function toGqlCredentials(
  credentials: CredentialsState
): GenerativeCredentialInput[] {
  const allCredentials: GenerativeCredentialInput[] = [];

  for (const [provider, config] of Object.entries(
    ProviderToCredentialsConfigMap
  )) {
    const providerCredentials = credentials[provider as ModelProvider];
    if (!providerCredentials) {
      continue;
    }
    for (const credential of config) {
      const value = providerCredentials[credential.envVarName];
      if (value) {
        allCredentials.push({
          envVarName: credential.envVarName,
          value,
        });
      }
    }
  }

  return allCredentials;
}

/** Convert a ChatMessageRole to the uppercase PromptMessageRole expected by the API */
function chatRoleToPromptRole(role: ChatMessageRole): PromptMessageRole {
  const map: Record<ChatMessageRole, PromptMessageRole> = {
    user: "USER",
    ai: "AI",
    system: "SYSTEM",
    tool: "TOOL",
  };
  return map[role] ?? "USER";
}

/** Convert a PlaygroundMessage to a PromptMessageInput for the hub-and-spoke GraphQL wire format */
function chatMessageToPromptMessageInput(message: ChatMessage): {
  role: PromptMessageRole;
  content: {
    text?: { text: string } | null;
    toolCall?: {
      toolCallId: string;
      toolCall: { name: string; arguments: string; type?: string | null };
    } | null;
    toolResult?: { toolCallId: string; result: unknown } | null;
  }[];
} {
  const toolCalls = message.toolCalls ?? [];
  const hasToolCalls = toolCalls.length > 0;
  const isToolResult = !!message.toolCallId;

  type ContentPart = ReturnType<
    typeof chatMessageToPromptMessageInput
  >["content"][number];
  const content: ContentPart[] = [];

  if (isToolResult) {
    content.push({
      toolResult: {
        toolCallId: message.toolCallId!,
        result: message.content ?? null,
      },
    });
  } else if (hasToolCalls) {
    // Text content is excluded when tool calls are present (follows instanceToPromptVersion pattern)
    for (const tc of toolCalls) {
      const id = findToolCallId(tc) ?? "";
      const name = findToolCallName(tc) ?? "";
      const args = findToolCallArguments(tc);
      const argsStr =
        typeof args === "string"
          ? args
          : args !== null
            ? JSON.stringify(args)
            : "{}";
      content.push({
        toolCall: {
          toolCallId: id,
          toolCall: { name, arguments: argsStr, type: "function" },
        },
      });
    }
  } else {
    if (message.content) {
      content.push({ text: { text: message.content } });
    }
  }

  return { role: chatRoleToPromptRole(message.role), content };
}

/**
 * Extract the scalar value from an InvocationParameterInput (whichever value field is set).
 * Returns null if no value is set.
 */
function extractInvocationParamValue(
  p: InvocationParameterInput
): unknown | null {
  return (
    p.valueFloat ??
    p.valueInt ??
    p.valueBool ??
    p.valueBoolean ??
    p.valueString ??
    p.valueJson ??
    p.valueStringList ??
    null
  );
}

/**
 * Convert an InvocationParameterInput[] to a plain object keyed by invocationName.
 * Only entries with a non-null value are included.
 */
function invocationParamsToFlatObject(
  params: InvocationParameterInput[]
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const p of params) {
    const value = extractInvocationParamValue(p);
    if (value !== null && value !== undefined) {
      result[p.invocationName] = value;
    }
  }
  return result;
}

/**
 * Convert a Tool from the Zustand store to the PromptToolFunctionInput wire format.
 * This is a passthrough because Tool.definition is already CanonicalToolDefinition,
 * which is isomorphic to the wire format.
 */
export function toolToPromptToolFunctionInput(tool: {
  definition: CanonicalToolDefinition | null | undefined;
}): {
  function: {
    name: string;
    description?: string | null;
    parameters?: unknown;
    strict?: boolean | null;
  };
} {
  return buildPromptToolFunctionInput(tool.definition);
}

/**
 * Converts the canonical response format (from ModelConfig) to the
 * provider-specific shape shown in the JSON editor.
 *
 * - OpenAI / Azure: `{ type, json_schema: { name, schema, strict?, description? } }`
 * - Anthropic: `{ type: "json_schema", schema }` (flat output_config style)
 * - Google: raw schema object only (no wrapper)
 *
 * Inverse: {@link displayToCanonicalResponseFormat}
 */
export function getResponseFormatDisplay(model: ModelConfig): unknown {
  if (!model.responseFormat) return null;
  const { jsonSchema } = model.responseFormat;
  if (model.provider === "GOOGLE" || model.provider === "AWS") {
    return jsonSchema.schema ?? {};
  }
  if (model.provider === "ANTHROPIC") {
    return { type: "json_schema", schema: jsonSchema.schema ?? {} };
  }
  return {
    type: "json_schema",
    json_schema: {
      name: jsonSchema.name,
      ...(jsonSchema.schema !== undefined && { schema: jsonSchema.schema }),
      ...(jsonSchema.strict !== undefined && { strict: jsonSchema.strict }),
      ...(jsonSchema.description != null && {
        description: jsonSchema.description,
      }),
    },
  };
}

/**
 * Converts the provider-specific display value from the JSON editor back to
 * canonical form for storage in ModelConfig.responseFormat.
 *
 * Inverse of {@link getResponseFormatDisplay}.
 */
export function displayToCanonicalResponseFormat(
  display: unknown,
  provider: ModelProvider
): CanonicalResponseFormat | null {
  if (!display || typeof display !== "object") return null;
  const d = display as Record<string, unknown>;
  if (provider === "GOOGLE" || provider === "AWS") {
    // Display is the raw schema object directly
    return {
      type: "json_schema",
      jsonSchema: { name: "response", schema: d },
    };
  }
  if (provider === "ANTHROPIC") {
    return {
      type: "json_schema",
      jsonSchema: { name: "response", schema: d.schema },
    };
  }
  const js = d.json_schema as Record<string, unknown> | undefined;
  if (!js) return null;
  return {
    type: "json_schema",
    jsonSchema: {
      name: typeof js.name === "string" ? js.name : "response",
      ...(js.schema !== undefined && { schema: js.schema }),
      ...(typeof js.strict === "boolean" && { strict: js.strict }),
      ...(typeof js.description === "string" && {
        description: js.description,
      }),
    },
  };
}

export function buildPromptResponseFormatInput(
  responseFormat: CanonicalResponseFormat | null | undefined
): CanonicalResponseFormat | null {
  return responseFormat ?? null;
}

/** When normalizing to canonical, store {} instead of { type: "object" } when it's the only key. */
function canonicalParameters(parameters: unknown): unknown {
  if (
    parameters == null ||
    typeof parameters !== "object" ||
    Array.isArray(parameters)
  ) {
    return parameters;
  }
  const o = parameters as Record<string, unknown>;
  const keys = Object.keys(o);
  if (keys.length === 1 && keys[0] === "type" && o.type === "object") {
    return {};
  }
  return parameters;
}

/**
 * Convert any provider-specific raw tool definition to the canonical form
 * stored on Tool.definition (hub of the hub-and-spoke).
 *
 * Parses each provider schema directly — no OpenAI pivot — mirroring how
 * {@link displayToCanonicalResponseFormat} handles response format.
 */
export function toCanonicalToolDefinition(
  raw: unknown
): CanonicalToolDefinition | null {
  // OpenAI Chat Completions: { type: "function", function: { name, description?, parameters, strict? } }
  const openai = openAIToolDefinitionSchema.safeParse(raw);
  if (openai.success) {
    const fn = openai.data.function as Record<string, unknown>;
    return {
      name: openai.data.function.name,
      description: openai.data.function.description ?? null,
      parameters: canonicalParameters(openai.data.function.parameters),
      // strict lives at the function level in the actual API but isn't in
      // our looseObject schema — extract safely.
      strict: typeof fn.strict === "boolean" ? fn.strict : null,
    };
  }
  // OpenAI Responses API: flat { type: "function", name, parameters, strict, description? }
  const responses = openAIResponsesToolDefinitionSchema.safeParse(raw);
  if (responses.success) {
    return {
      name: responses.data.name,
      description: responses.data.description ?? null,
      parameters: canonicalParameters(responses.data.parameters),
      strict: responses.data.strict,
    };
  }
  // Anthropic: { name, description, input_schema }
  const anthropic = anthropicToolDefinitionSchema.safeParse(raw);
  if (anthropic.success) {
    return {
      name: anthropic.data.name,
      description: anthropic.data.description ?? null,
      parameters: canonicalParameters(anthropic.data.input_schema),
      strict: null,
    };
  }
  // AWS: { toolSpec: { name, description, inputSchema: { json } } }
  const aws = awsToolDefinitionSchema.safeParse(raw);
  if (aws.success) {
    return {
      name: aws.data.toolSpec.name,
      description: aws.data.toolSpec.description ?? null,
      parameters: canonicalParameters(aws.data.toolSpec.inputSchema.json),
      strict: null,
    };
  }
  // Gemini: { name, description?, parameters? | parameters_json_schema? }
  const gemini = geminiToolDefinitionSchema.safeParse(raw);
  if (gemini.success) {
    const params =
      gemini.data.parameters ?? gemini.data.parameters_json_schema ?? {};
    return {
      name: gemini.data.name,
      description: gemini.data.description ?? null,
      parameters: canonicalParameters(params),
      strict: null,
    };
  }
  return null;
}

/**
 * For display in the JSON editor: ensure parameters/input_schema has "type": "object" when missing.
 * Used for Anthropic (input_schema) and AWS (inputSchema.json) which require it.
 * Not used for OpenAI: having only "type": "object" (and nothing else) is not allowed there.
 */
function parametersSchemaWithObjectType(
  parameters: unknown
): Record<string, unknown> {
  const obj =
    parameters != null &&
    typeof parameters === "object" &&
    !Array.isArray(parameters)
      ? (parameters as Record<string, unknown>)
      : {};
  if (obj.type === undefined) {
    return { ...obj, type: "object" };
  }
  return obj;
}

/**
 * Convert canonical tool definition to the provider-specific display format
 * shown in the JSON editor (spoke of the hub-and-spoke).
 *
 * Constructs provider shapes directly — no OpenAI pivot — mirroring how
 * {@link getResponseFormatDisplay} handles response format.
 */
export function getToolDefinitionDisplay(
  toolDefinition: CanonicalToolDefinition,
  provider: ModelProvider
): unknown {
  if (provider === "ANTHROPIC") {
    return {
      name: toolDefinition.name,
      ...(toolDefinition.description != null && {
        description: toolDefinition.description,
      }),
      input_schema: parametersSchemaWithObjectType(toolDefinition.parameters),
    };
  }
  if (provider === "AWS") {
    return {
      toolSpec: {
        name: toolDefinition.name,
        ...(toolDefinition.description != null && {
          description: toolDefinition.description,
        }),
        inputSchema: {
          json: parametersSchemaWithObjectType(toolDefinition.parameters),
        },
      },
    };
  }
  if (provider === "GOOGLE") {
    return {
      name: toolDefinition.name,
      ...(toolDefinition.description != null && {
        description: toolDefinition.description,
      }),
      ...(toolDefinition.parameters != null && {
        parameters: toolDefinition.parameters,
      }),
    };
  }
  // OpenAI-compatible: OPENAI, AZURE_OPENAI, DEEPSEEK, XAI, OLLAMA, CEREBRAS,
  // FIREWORKS, GROQ, MOONSHOT, PERPLEXITY, TOGETHER
  return {
    type: "function",
    function: {
      name: toolDefinition.name,
      ...(toolDefinition.description != null && {
        description: toolDefinition.description,
      }),
      ...(toolDefinition.parameters != null && {
        parameters: toolDefinition.parameters,
      }),
      ...(toolDefinition.strict != null && { strict: toolDefinition.strict }),
    },
  };
}

/**
 * Convert a provider-specific JSON editor value back to canonical form.
 * Inverse of {@link getToolDefinitionDisplay}.
 */
export function displayToCanonicalToolDefinition(
  display: unknown
): CanonicalToolDefinition | null {
  return toCanonicalToolDefinition(display);
}

/**
 * Convert a canonical tool definition to the PromptToolFunctionInput wire format
 * for saving to the backend (passthrough — canonical is already the wire shape).
 */
export function buildPromptToolFunctionInput(
  toolDefinition: CanonicalToolDefinition | null | undefined
): {
  function: {
    name: string;
    description?: string | null;
    parameters?: unknown;
    strict?: boolean | null;
  };
} {
  return {
    function: {
      name: toolDefinition?.name ?? "",
      description: toolDefinition?.description ?? null,
      parameters: toolDefinition?.parameters ?? null,
      strict: toolDefinition?.strict ?? null,
    },
  };
}

/**
 * Convert a canonical tool choice to the PromptToolChoiceInput wire format
 * (isomorphic to DB PromptToolChoice).
 */
export function toCanonicalToolChoice(
  toolChoice: CanonicalToolChoice | null | undefined
):
  | { none: true }
  | { zeroOrMore: true }
  | { oneOrMore: true }
  | { functionName: string }
  | null {
  if (toolChoice == null) return null;
  switch (toolChoice.type) {
    case "NONE":
      return { none: true };
    case "ZERO_OR_MORE":
      return { zeroOrMore: true };
    case "ONE_OR_MORE":
      return { oneOrMore: true };
    case "SPECIFIC_FUNCTION":
      return { functionName: toolChoice.functionName ?? "" };
  }
}

/**
 * Gets chat completion input for running over variables.
 *
 * Builds the hub-and-spoke ChatCompletionInput shape where prompt content
 * (messages, invocation parameters, tools, response format) travels via the
 * normalized ChatPromptVersionInput wire type.
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
  // Use the existing helper for model, credentials, and invocation params
  // (with provider constraints applied).
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
    repetitions,
    streaming,
  } = playgroundStore.getState();

  const instance = instances.find((i) => i.id === instanceId);
  if (!instance) {
    throw new Error(`No instance found for id ${instanceId}`);
  }
  if (instance.template.__type !== "chat") {
    throw new Error("We only support chat templates for now");
  }

  // Compute template variables for mustache / f-string substitution
  const playgroundInstances = instances.map((i) =>
    denormalizePlaygroundInstance(i, instanceMessages)
  );
  const { variablesMap } = getVariablesMapFromInstances({
    instances: playgroundInstances,
    input,
    templateFormat,
  });

  // Convert messages to PromptMessageInput
  const denormalized = denormalizePlaygroundInstance(
    instance,
    instanceMessages
  );
  if (denormalized.template.__type !== "chat") {
    throw new Error("We only support chat templates for now");
  }
  const promptMessages = denormalized.template.messages.map(
    chatMessageToPromptMessageInput
  );

  const promptVersion: ChatPromptVersionInput = {
    templateFormat: "NONE",
    template: {
      messages:
        promptMessages as ChatPromptVersionInput["template"]["messages"],
    },
    modelProvider: instance.model
      .provider as ChatPromptVersionInput["modelProvider"],
    modelName: instance.model.modelName ?? "",
    customProviderId: instance.model.customProvider?.id ?? null,
    invocationParameters: invocationParamsToFlatObject(
      baseChatCompletionVariables.invocationParameters ?? []
    ),
    tools: instance.tools.length
      ? {
          tools: instance.tools.map(toolToPromptToolFunctionInput),
          toolChoice: toCanonicalToolChoice(instance.toolChoice),
        }
      : null,
    responseFormat: buildPromptResponseFormatInput(
      instance.model.responseFormat
    ),
  };

  return {
    promptVersion,
    clientOptions: baseChatCompletionVariables.clientOptions,
    credentials: baseChatCompletionVariables.credentials,
    template: {
      variables: variablesMap,
      format: templateFormat,
    },
    promptName: instance.prompt?.name,
    repetitions,
    streamModelOutput: streaming,
  } satisfies ChatCompletionInput;
};

/**
 * Gets chat completion input for running over a dataset.
 *
 * Builds the same hub-and-spoke ChatCompletionOverDatasetInput shape as
 * getChatCompletionInput, but uses the store's templateFormat (MUSTACHE /
 * F_STRING / NONE) rather than hardcoding "NONE", so dataset-level variable
 * substitution still works.
 */
export const getChatCompletionOverDatasetInput = ({
  playgroundStore,
  instanceId,
  credentials,
  datasetId,
  splitIds,
  evaluatorMappings,
}: {
  playgroundStore: PlaygroundStore;
  instanceId: number;
  credentials: CredentialsState;
  datasetId: string;
  splitIds?: string[];
  /**
   * Record of datasetEvaluatorId to name and input mappings
   */
  evaluatorMappings: Record<
    string,
    { name: string; inputMapping: EvaluatorInputMappingInput }
  >;
}): ChatCompletionOverDatasetInput => {
  const baseChatCompletionVariables = getBaseChatCompletionInput({
    playgroundStore,
    instanceId,
    credentials,
  });

  const {
    instances,
    templateFormat,
    repetitions,
    allInstanceMessages: instanceMessages,
    stateByDatasetId,
    streaming,
    recordExperiments,
  } = playgroundStore.getState();

  const instance = instances.find((i) => i.id === instanceId);
  if (!instance) {
    throw new Error(`No instance found for id ${instanceId}`);
  }
  if (instance.template.__type !== "chat") {
    throw new Error("We only support chat templates for now");
  }

  // Convert messages to PromptMessageInput
  const denormalized = denormalizePlaygroundInstance(
    instance,
    instanceMessages
  );
  if (denormalized.template.__type !== "chat") {
    throw new Error("We only support chat templates for now");
  }
  const promptMessages = denormalized.template.messages.map(
    chatMessageToPromptMessageInput
  );

  const promptVersion: ChatPromptVersionInput = {
    templateFormat: templateFormat as ChatPromptVersionInput["templateFormat"],
    template: {
      messages:
        promptMessages as ChatPromptVersionInput["template"]["messages"],
    },
    modelProvider: instance.model
      .provider as ChatPromptVersionInput["modelProvider"],
    modelName: instance.model.modelName ?? "",
    customProviderId: instance.model.customProvider?.id ?? null,
    invocationParameters: invocationParamsToFlatObject(
      baseChatCompletionVariables.invocationParameters ?? []
    ),
    tools: instance.tools.length
      ? {
          tools: instance.tools.map(toolToPromptToolFunctionInput),
          toolChoice: toCanonicalToolChoice(instance.toolChoice),
        }
      : null,
    responseFormat: buildPromptResponseFormatInput(
      instance.model.responseFormat
    ),
  };

  const playgroundDatasetState = stateByDatasetId[datasetId];
  const { appendedMessagesPath, templateVariablesPath } =
    playgroundDatasetState ?? {};

  return {
    promptVersion,
    clientOptions: baseChatCompletionVariables.clientOptions,
    credentials: baseChatCompletionVariables.credentials,
    repetitions,
    datasetId,
    splitIds: splitIds ?? null,
    evaluators: Object.entries(evaluatorMappings).map(
      ([datasetEvaluatorId, { name, inputMapping }]) => ({
        id: datasetEvaluatorId,
        name,
        inputMapping,
      })
    ),
    appendedMessagesPath,
    templateVariablesPath: templateVariablesPath ?? "",
    promptName: instance.prompt?.name,
    streamModelOutput: streaming,
    createEphemeralExperiment: !recordExperiments,
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
 * Schema for validating if Anthropic extended thinking is enabled.
 */
const anthropicExtendedThinkingEnabledSchema = z.looseObject({
  type: z.literal("enabled"),
});

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
      return !(param.valueFloat === 0 || param.valueInt === 0);
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
const LS_METADATA_SCHEMA = z.looseObject({
  metadata: z
    .object({
      ls_model_name: z.string().optional(),
    })
    .optional(),
});

// Parse Azure details (endpoint, deployment name) from URL
function parseAzureDeploymentInfoFromUrl(fullUrl: string): {
  endpoint: string | null;
  deploymentName: string | null;
} {
  try {
    const urlObj = new URL(fullUrl);
    const endpoint = urlObj.origin.trim();
    const path = (urlObj.pathname || "").toString();
    const match = path.match(AZURE_DEPLOYMENT_PATH_REGEX);
    const deploymentName = match && match[1] ? match[1].trim() : null;
    return { endpoint, deploymentName };
  } catch {
    return { endpoint: null, deploymentName: null };
  }
}
