import { extractDecisionVariables } from "@phoenix/components/playground/decisionUtils";
import type { ProviderInvocationConfig } from "@phoenix/components/playground/providerAdapters";
import {
  getVisibleInvocationParameterSpecs,
  invocationConfigToPromptInput,
  readInvocationConfigField,
} from "@phoenix/components/playground/providerAdapters";
import { chatMessageRolesSchema } from "@phoenix/components/playground/schemas";
import { TemplateFormats } from "@phoenix/components/templateEditor/constants";
import { getTemplateFormatUtils } from "@phoenix/components/templateEditor/templateEditorUtils";
import type { TemplateFormat } from "@phoenix/components/templateEditor/types";
import {
  ChatRoleMap,
  DEFAULT_CHAT_ROLE,
  DEFAULT_OPENAI_API_TYPE,
  ProviderToCredentialsConfigMap,
} from "@phoenix/constants/generativeConstants";
import type { GenerativeCredentialInput } from "@phoenix/pages/playground/__generated__/PlaygroundOutputSubscription.graphql";
import type { ChatPromptVersionInput } from "@phoenix/pages/playground/__generated__/UpsertPromptFromTemplateDialogCreateMutation.graphql";
import type { LlmProviderToolCall } from "@phoenix/schemas/toolCallSchemas";
import {
  createAnthropicToolCall,
  createOpenAIToolCall,
} from "@phoenix/schemas/toolCallSchemas";
import type { CredentialsState } from "@phoenix/store/credentialsStore";
import type {
  CanonicalResponseFormat,
  CanonicalToolChoice,
  CanonicalToolDefinition,
  ChatMessage,
  DecisionPromptDraft,
  ModelConfig,
  PlaygroundInput,
  PlaygroundInstance,
  PlaygroundNormalizedInstance,
  Tool,
} from "@phoenix/store/playground";
import { generateToolId, isDecisionInstance } from "@phoenix/store/playground";
import { assertUnreachable, isStringKeyedObject } from "@phoenix/typeUtils";

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
 * Tool `type` values that are exclusive to OpenAI Chat Completions (i.e. not
 * accepted by the Responses API). Used as a negative list so that a tool with
 * one of these types is NOT treated as a Responses signal even though its
 * type isn't "function".
 *
 * Currently just "custom" (ChatCompletionCustomToolParam — a Chat-Completions
 * tool that processes input via a specified format). If OpenAI ever ships
 * another non-function Chat-Completions-only tool, add it here. Failure mode
 * if we miss one: prompts containing it get misclassified as Responses, which
 * surfaces as a confusing 400 from OpenAI at request time.
 */
const CHAT_COMPLETIONS_ONLY_NON_FUNCTION_TYPES: ReadonlySet<string> = new Set([
  "custom",
]);

/**
 * Two positive signals that a tool came from the OpenAI Responses API:
 *
 *   1. The tool's `type` is a non-"function" string AND is not in the
 *      Chat-Completions-only set above (e.g. "web_search", "file_search",
 *      "computer_use_preview"). Chat Completions otherwise only accepts
 *      function tools, so seeing any other type is proof of Responses.
 *   2. The tool is a function tool but in *flat* Responses shape:
 *      `{ type: "function", name, parameters, ... }` with the function fields
 *      at the top level. Chat Completions wraps them in a nested
 *      `function: { name, parameters, ... }` sub-object instead.
 *
 * Either signal alone is sufficient. Returns null if neither is present (the
 * tool could be Chat Completions or could be a Responses prompt that happens
 * to contain only Chat-Completions-shaped tools — we can't distinguish those).
 */
export function isResponsesShapedRawTool(definition: unknown): boolean {
  if (!isStringKeyedObject(definition)) {
    return false;
  }
  const type = definition.type;
  if (typeof type !== "string") {
    return false;
  }
  if (type !== "function") {
    return !CHAT_COMPLETIONS_ONLY_NON_FUNCTION_TYPES.has(type);
  }
  // type: "function" — Chat Completions nests fields under `function`,
  // Responses puts them at the top level.
  return !isStringKeyedObject(definition.function);
}

/**
 * Infer the OpenAI API surface from tool shape. A Responses-only shape on any
 * tool ⇒ Responses; otherwise return `fallback` (Responses also accepts
 * Chat-Completions-shaped function tools, so the absence of a positive signal
 * isn't proof of Chat Completions).
 *
 * Spec: https://platform.openai.com/docs/api-reference/chat/create vs
 * https://platform.openai.com/docs/api-reference/responses/create
 *
 * Only consults `kind: "raw"` tools — `kind: "function"` tools have already
 * been normalized, losing the original shape signal.
 */
export function inferOpenAIApiTypeFromTools(
  tools: readonly Tool[],
  fallback: OpenAIApiType | null = null
): OpenAIApiType | null {
  const hasResponsesShape = tools.some(
    (tool) => tool.kind === "raw" && isResponsesShapedRawTool(tool.raw)
  );
  return hasResponsesShape ? "RESPONSES" : fallback;
}

/** Discriminator predicate for the function-tool branch of {@link Tool}. */
export const isFunctionTool = (
  tool: Tool
): tool is Extract<Tool, { kind: "function" }> => tool.kind === "function";

/** Discriminator predicate for the raw-tool branch of {@link Tool}. */
export const isRawTool = (tool: Tool): tool is Extract<Tool, { kind: "raw" }> =>
  tool.kind === "raw";

/**
 * Best-effort display name for any tool, function or raw. For raw tools the
 * tool's own `name` field is preferred, falling back to its `type`.
 */
export const getToolName = (tool: Tool): string | null => {
  if (isFunctionTool(tool)) {
    return tool.definition?.name ?? null;
  }
  const rawName = typeof tool.raw.name === "string" ? tool.raw.name : null;
  const rawType = typeof tool.raw.type === "string" ? tool.raw.type : null;
  return rawName ?? rawType;
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
    case "MINIMAX":
    case "PERPLEXITY":
    case "TOGETHER":
    case "ZAI":
    case "META":
      return createOpenAIToolCall();
    case "ANTHROPIC":
      return createAnthropicToolCall();
    // TODO(apowell): #5348 Add Google tool call
    case "GOOGLE":
      return createOpenAIToolCall();
    case "TYPESAFE":
      throw new Error("Decision models do not support chat tool calls");
    default:
      return assertUnreachable(provider);
  }
};

/**
 * Denormalize a playground instance with the actual messages and decision prompt
 *
 * A playground instance differs from a playground normalized instance in that it contains the actual messages
 * and decision prompts and not just their ids. This function will replace the ids with the actual values.
 */
export const denormalizePlaygroundInstance = (
  { decisionPromptId, ...instance }: PlaygroundNormalizedInstance,
  allInstanceMessages: Record<number, ChatMessage>,
  allInstanceDecisionPrompts: Record<number, DecisionPromptDraft>
): PlaygroundInstance => {
  const decisionPrompt =
    decisionPromptId != null
      ? allInstanceDecisionPrompts[decisionPromptId]
      : decisionPromptId;
  if (instance.template.__type === "chat") {
    const { messageIds: _, ...rest } = instance.template;
    return {
      ...instance,
      decisionPrompt,
      template: {
        ...rest,
        messages: instance.template.messageIds.map(
          (messageId) => allInstanceMessages[messageId]
        ),
      },
    } satisfies PlaygroundInstance;
  }
  return {
    ...instance,
    decisionPrompt,
    template: instance.template,
  } satisfies PlaygroundInstance;
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

export function buildPromptResponseFormatInput(
  responseFormat: CanonicalResponseFormat | null | undefined
): CanonicalResponseFormat | null {
  return responseFormat ?? null;
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
      ...(toolDefinition.strict != null && { strict: toolDefinition.strict }),
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
        ...(toolDefinition.strict != null && { strict: toolDefinition.strict }),
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
  // FIREWORKS, GROQ, MOONSHOT, MINIMAX, PERPLEXITY, TOGETHER, ZAI, META
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
 * Shape of a single tool element from any Relay `tools.tools` selection that
 * spreads on `PromptToolFunction` and `PromptToolRaw` (e.g. the fragments in
 * fetchPlaygroundPrompt.ts, experimentRehydration.ts, and PromptTools.tsx).
 * Mirrors the generated discriminated union with `__typename` as the tag,
 * including Relay's `"%other"` fallthrough variant.
 */
export type GraphQLPromptTool =
  | {
      readonly __typename: "PromptToolFunction";
      readonly function: {
        readonly name: string;
        readonly description: string | null;
        readonly parameters: unknown;
        readonly strict: boolean | null;
      };
    }
  | {
      readonly __typename: "PromptToolRaw";
      readonly raw: unknown;
    }
  | { readonly __typename: "%other" };

export function promptToolFromGraphQL(tool: GraphQLPromptTool): Tool | null {
  switch (tool.__typename) {
    case "PromptToolFunction":
      return {
        kind: "function",
        id: generateToolId(),
        editorType: "json",
        definition: {
          name: tool.function.name,
          description: tool.function.description ?? null,
          parameters: tool.function.parameters,
          strict: tool.function.strict ?? null,
        },
      };
    case "PromptToolRaw":
      if (!isStringKeyedObject(tool.raw)) {
        return null;
      }
      return {
        kind: "raw",
        id: generateToolId(),
        editorType: "json",
        raw: tool.raw,
      };
    case "%other":
      // Schema added a tool variant the client wasn't built against. Drop it
      // (the alternative is crashing the prompt page on schema drift).
      return null;
    default:
      return assertUnreachable(tool);
  }
}

/**
 * Pull the prompt's tools and inferred OpenAI API surface out of a GraphQL
 * `tools.tools` array. Centralizes the logic shared by the prompt-loading and
 * experiment-rehydration paths so they can't drift.
 */
export function deriveToolsAndOpenAIApiType(
  rawTools: readonly GraphQLPromptTool[] | null | undefined,
  provider: ModelProvider
): { tools: Tool[]; openaiApiType: OpenAIApiType | null } {
  const tools = (rawTools ?? [])
    .map(promptToolFromGraphQL)
    .filter((tool): tool is Tool => tool != null);
  const isOpenAIProvider = provider === "OPENAI" || provider === "AZURE_OPENAI";
  const openaiApiType = isOpenAIProvider
    ? inferOpenAIApiTypeFromTools(tools, DEFAULT_OPENAI_API_TYPE)
    : null;
  return { tools, openaiApiType };
}

export function toolToPromptToolInput(
  tool: Tool
):
  | ReturnType<typeof buildPromptToolFunctionInput>
  | { raw: Record<string, unknown> } {
  if (isRawTool(tool)) {
    return { raw: tool.raw };
  }
  return buildPromptToolFunctionInput(tool.definition);
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
    default:
      return assertUnreachable(toolChoice.type);
  }
}

/**
 * Shared prompt-version payload builder used by playground save/run paths.
 */
export function buildPromptVersionInput({
  instance,
  modelName,
  templateFormat,
  promptMessages,
  invocationParameters,
}: {
  instance: Pick<PlaygroundInstance, "model" | "tools" | "toolChoice">;
  modelName: string;
  templateFormat: ChatPromptVersionInput["templateFormat"];
  promptMessages: ChatPromptVersionInput["template"]["messages"];
  invocationParameters: ProviderInvocationConfig;
}): ChatPromptVersionInput {
  return {
    templateFormat,
    template: {
      messages: promptMessages,
    },
    modelProvider: instance.model
      .provider as ChatPromptVersionInput["modelProvider"],
    modelName,
    customProviderId: instance.model.customProvider?.id ?? null,
    invocationParameters: invocationConfigToPromptInput(
      instance.model.provider,
      invocationParameters
    ),
    tools: instance.tools.length
      ? {
          tools: instance.tools.map(toolToPromptToolInput),
          toolChoice: toCanonicalToolChoice(instance.toolChoice),
        }
      : null,
    responseFormat: buildPromptResponseFormatInput(
      instance.model.responseFormat
    ),
  };
}

export function areRequiredInvocationParametersConfigured(
  config: ProviderInvocationConfig,
  model: Pick<ModelConfig, "provider" | "openaiApiType">
) {
  const requiredSpecs = getVisibleInvocationParameterSpecs(
    model,
    config
  ).filter((s) => s.required);
  return requiredSpecs.every(
    (spec) =>
      readInvocationConfigField(model.provider, config, spec.name) !== undefined
  );
}

export const extractVariablesFromInstance = ({
  instance,
  templateFormat,
}: {
  instance: PlaygroundInstance;
  templateFormat: TemplateFormat;
}) => {
  // A decision instance carries its variables in the request's text fields;
  // its chat template is the one it restores when switched back to an LLM.
  if (isDecisionInstance(instance)) {
    return extractDecisionVariables({
      draft: instance.decisionPrompt,
      templateFormat,
    });
  }
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
  const variableKeys = extractVariablesFromInstances({
    instances,
    templateFormat,
  });
  if (variableKeys.length === 0) {
    return { variablesMap: {}, variableKeys: [] };
  }

  const variableValueCache = input.variablesValueCache ?? {};

  const variablesMap = variableKeys.reduce<
    NonNullable<PlaygroundInput["variablesValueCache"]>
  >((acc, key) => {
    acc[key] = variableValueCache[key] || "";
    return acc;
  }, {});
  return { variablesMap, variableKeys };
};
