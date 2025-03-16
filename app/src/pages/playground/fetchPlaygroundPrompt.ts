import { fetchQuery, graphql } from "react-relay";

import { DEFAULT_MODEL_NAME } from "@phoenix/constants/generativeConstants";
import { fetchPlaygroundPromptSupportedInvocationParametersQuery } from "@phoenix/pages/playground/__generated__/fetchPlaygroundPromptSupportedInvocationParametersQuery.graphql";
import { GenerativeProviderKey } from "@phoenix/pages/playground/__generated__/ModelSupportedParamsFetcherQuery.graphql";
import { ChatPromptVersionInput } from "@phoenix/pages/playground/__generated__/UpsertPromptFromTemplateDialogCreateMutation.graphql";
import {
  RESPONSE_FORMAT_PARAM_CANONICAL_NAME,
  RESPONSE_FORMAT_PARAM_NAME,
  TOOL_CHOICE_PARAM_CANONICAL_NAME,
  TOOL_CHOICE_PARAM_NAME,
} from "@phoenix/pages/playground/constants";
import {
  applyProviderInvocationParameterConstraints,
  areInvocationParamsEqual,
  getChatRole,
  toCamelCase,
} from "@phoenix/pages/playground/playgroundUtils";
import RelayEnvironment from "@phoenix/RelayEnvironment";
import {
  TextPart,
  ToolCallPart,
  ToolResultPart,
} from "@phoenix/schemas/promptSchemas";
import { fromPromptToolCallPart } from "@phoenix/schemas/toolCallSchemas";
import { safelyConvertToolChoiceToProvider } from "@phoenix/schemas/toolChoiceSchemas";
import {
  DEFAULT_INSTANCE_PARAMS,
  generateMessageId,
  generateToolId,
  PlaygroundInstance,
} from "@phoenix/store/playground";
import { Mutable } from "@phoenix/typeUtils";
import { safelyStringifyJSON } from "@phoenix/utils/jsonUtils";
import {
  asTextPart,
  asToolCallPart,
  asToolResultPart,
  makeTextPart,
  makeToolCallPart,
  makeToolResultPart,
} from "@phoenix/utils/promptUtils";

import {
  fetchPlaygroundPromptQuery,
  fetchPlaygroundPromptQuery$data,
  PromptMessageRole,
} from "./__generated__/fetchPlaygroundPromptQuery.graphql";

type PromptVersion = NonNullable<
  fetchPlaygroundPromptQuery$data["prompt"]["version"]
>;

/**
 * Converts a playground chat message role to a prompt message role
 * @param role - The playground chat message role
 * @returns The prompt message role
 */
export const chatMessageRoleToPromptMessageRole = (
  role: ChatMessageRole
): PromptMessageRole => {
  switch (role) {
    case "user":
      return "USER";
    case "ai":
      return "AI";
    case "system":
      return "SYSTEM";
    case "tool":
      return "TOOL";
    default:
      return "USER";
  }
};

/**
 * Converts an arbitrary object into a list of invocation parameters.
 *
 * Incoming invocation parameters are expecting to be provided alongside supported invocation parameters
 * to ensure that the invocation parameters are valid for the model of the instance, and so that we can
 * coerce the incoming invocation parameters to the expected format (e.g. {temperature: 0.5} -> {invocationName: "temperature", valueFloat: 0.5}).
 *
 * @param invocationParameters - The invocation parameters to convert
 * @param supportedInvocationParameters - The supported invocation parameters for the model of the instance
 * @returns The invocation parameters as a list
 */
export const objectToInvocationParameters = (
  invocationParameters: Record<string, unknown>,
  supportedInvocationParameters: PlaygroundInstance["model"]["supportedInvocationParameters"]
): PlaygroundInstance["model"]["invocationParameters"] => {
  // build a lookup map of incoming invocation parameters to the closest matching supported invocation parameter
  // we won't have canonical names at this point, because we don't know where the invocation parameters are coming from
  // so we'll use the invocation name as the key
  const invocationParameterDefinitionMap =
    supportedInvocationParameters.length > 0
      ? supportedInvocationParameters.reduce(
          (acc, curr) => {
            if (curr.invocationName) {
              acc[curr.invocationName] = curr;
            }
            return acc;
          },
          {} as Record<string, (typeof supportedInvocationParameters)[number]>
        )
      : {};
  // now we'll map the incoming invocation parameters to the supported invocation parameters
  // we'll use the invocation name as the key
  return Object.entries(invocationParameters).map(([key, value]) => {
    const definition = invocationParameterDefinitionMap[key];
    if (!definition || !definition.invocationInputField) {
      return {
        invocationName: key,
        valueJson: value,
      };
    }
    return {
      invocationName: key,
      canonicalName: definition.canonicalName,
      [toCamelCase(definition.invocationInputField)]: value,
    };
  });
};

/**
 * Converts a prompt version to a playground instance.
 *
 * The playground instance is missing an id, it will need to be generated before usage.
 *
 * @param promptId - The prompt ID
 * @param promptVersion - The prompt version
 * @param supportedInvocationParameters - The supported invocation parameters for the model of the instance, if available.
 *   invocation parameters will not be parsed if not provided.
 * @returns The playground instance
 */
export const promptVersionToInstance = ({
  promptId,
  promptName,
  promptVersion,
  supportedInvocationParameters,
}: {
  promptId: string;
  promptName: string;
  promptVersion: PromptVersion;
  supportedInvocationParameters?: PlaygroundInstance["model"]["supportedInvocationParameters"];
}) => {
  const newInstance = {
    ...DEFAULT_INSTANCE_PARAMS(),
    prompt: { id: promptId, name: promptName },
  } satisfies Partial<PlaygroundInstance>;

  const modelName = promptVersion.modelName;
  const provider = promptVersion.modelProvider;
  const toolChoice =
    safelyConvertToolChoiceToProvider({
      toolChoice: promptVersion.invocationParameters?.tool_choice,
      targetProvider: provider,
    }) ?? undefined;
  return {
    ...newInstance,
    model: {
      ...newInstance.model,
      modelName,
      provider,
      supportedInvocationParameters: supportedInvocationParameters || [],
      invocationParameters: objectToInvocationParameters(
        {
          ...promptVersion.invocationParameters,
          ...(promptVersion.responseFormat?.definition
            ? {
                response_format: promptVersion.responseFormat.definition,
              }
            : {}),
        },
        supportedInvocationParameters || []
      ),
    },
    template: {
      __type: "chat",
      messages:
        "messages" in promptVersion.template
          ? promptVersion.template.messages.map((m) => {
              // select all parts
              const textContent = (
                m.content.map(asTextPart).filter(Boolean) as TextPart[]
              )
                // summarize text parts into a single string, this is a temporary solution
                // until the playground is updated to natively render message parts
                .map((part) => part.text.text)
                .join("");
              const toolCallParts = m.content
                .filter(asToolCallPart)
                .filter(Boolean) as ToolCallPart[];
              const toolResultParts = m.content
                .filter(asToolResultPart)
                .filter(Boolean) as ToolResultPart[];
              const firstToolResultPart = toolResultParts.at(0);
              const role = getChatRole(m.role);
              // determine how to build the message based on the available parts
              // ideally playground is updated in the future to natively render message parts

              if (role === "tool" && firstToolResultPart) {
                return {
                  id: generateMessageId(),
                  role: getChatRole(m.role),
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
                  role: getChatRole(m.role),
                  toolCalls: toolCallParts.map((toolCall) =>
                    fromPromptToolCallPart(toolCall, provider)
                  ),
                };
              }

              return {
                id: generateMessageId(),
                role: getChatRole(m.role),
                content: textContent,
              };
            })
          : [],
    },
    tools: promptVersion.tools.map((t) => ({
      id: generateToolId(),
      definition: t.definition,
    })),
    toolChoice,
  } satisfies Partial<PlaygroundInstance>;
};

/**
 * Converts invocation parameters to an object of key-value pairs, where the key is the invocation parameter name
 * and the value is the value of the invocation parameter.
 *
 * @param invocationParameters - The invocation parameters set in the instance
 * @param supportedInvocationParameters - The supported invocation parameters for the model of the instance
 *
 * @returns The invocation parameters as an object, constrained to the supported invocation parameters
 */
export const invocationParametersToObject = (
  invocationParameters: PlaygroundInstance["model"]["invocationParameters"],
  supportedInvocationParameters: PlaygroundInstance["model"]["supportedInvocationParameters"]
) => {
  const invocationParameterDefinitionMap =
    supportedInvocationParameters.length > 0
      ? supportedInvocationParameters.reduce(
          (acc, curr) => {
            if (curr.canonicalName || curr.invocationName) {
              acc[(curr.canonicalName || curr.invocationName) as string] = curr;
            }
            return acc;
          },
          {} as Record<string, (typeof supportedInvocationParameters)[number]>
        )
      : {};
  return invocationParameters.reduce(
    (acc, curr) => {
      const definition =
        invocationParameterDefinitionMap[
          curr.canonicalName || curr.invocationName
        ];
      if (definition) {
        acc[curr.invocationName] =
          curr[
            toCamelCase(
              definition.invocationInputField as string
            ) as keyof typeof curr
          ];
      }
      return acc;
    },
    {} as Record<
      string,
      string | number | boolean | null | Record<string, unknown> | unknown[]
    >
  );
};

const HIDDEN_INVOCATION_PARAMETERS = [
  {
    invocationName: TOOL_CHOICE_PARAM_NAME,
    canonicalName: TOOL_CHOICE_PARAM_CANONICAL_NAME,
  },
  {
    invocationName: RESPONSE_FORMAT_PARAM_NAME,
    canonicalName: RESPONSE_FORMAT_PARAM_CANONICAL_NAME,
  },
] as const;

/**
 * Converts a playground instance to a prompt version.
 *
 * @todo(apowell): The output may be better suited as PromptCreateInput
 *
 * @param instance - The playground instance
 * @returns The prompt version
 */
export const instanceToPromptVersion = (instance: PlaygroundInstance) => {
  if (instance.template.__type === "text_completion") {
    // eslint-disable-next-line no-console
    console.warn(
      "Instance to prompt version conversion not supported for text completion"
    );
    return null;
  }

  const templateMessages = instance.template.messages.map((m) => {
    // turn message content into a text part
    let textParts = [m.content ? makeTextPart(m.content) : null];
    // turn tool calls into tool call parts
    const toolCallParts = m.toolCalls?.map(makeToolCallPart) || [];
    // turn tool results into tool result parts
    const toolResultParts = m.toolCallId
      ? [makeToolResultPart(m.toolCallId, m.content)]
      : [];
    if (toolCallParts.length > 0 || toolResultParts.length > 0) {
      // this is a temporary solution until the playground is updated to natively render message parts
      // right now, it only support text, tool calls, or tool results, not a mix of them
      // keeping the text parts around may inadvertently save transient content state from the playground
      // that was invisible to the user at save time
      textParts = [];
    }
    return {
      content: (
        [...textParts, ...toolCallParts, ...toolResultParts] satisfies (
          | ChatPromptVersionInput["template"]["messages"][number]["content"][number]
          | null
        )[]
      ).filter((part) => part !== null),
      role: chatMessageRoleToPromptMessageRole(m.role),
    };
    // filter is removing nulls but type inference does not work for .filter
    // we have to cast to get the type inference to work
    // we do a proper typecheck above to ensure that this cast is safe
  }) as ChatPromptVersionInput["template"]["messages"];

  const newPromptVersion = {
    modelName: instance.model.modelName || DEFAULT_MODEL_NAME,
    modelProvider: instance.model.provider,
    template: {
      messages: templateMessages,
    },
    tools: instance.tools.map((tool) => ({
      definition: tool.definition,
    })),
    responseFormat:
      instance.model.invocationParameters
        .filter(
          (invocationParameter) =>
            invocationParameter.canonicalName ===
              RESPONSE_FORMAT_PARAM_CANONICAL_NAME ||
            invocationParameter.invocationName === RESPONSE_FORMAT_PARAM_NAME
        )
        .map((invocationParameter) => ({
          definition: invocationParameter.valueJson,
        }))
        .at(0) || undefined,
    invocationParameters: invocationParametersToObject(
      applyProviderInvocationParameterConstraints(
        instance.model.invocationParameters
          .filter(
            (invocationParameter) =>
              !HIDDEN_INVOCATION_PARAMETERS.some((hidden) =>
                areInvocationParamsEqual(hidden, invocationParameter)
              )
          )
          .concat(
            instance.toolChoice
              ? [
                  {
                    invocationName: TOOL_CHOICE_PARAM_NAME,
                    valueJson: instance.toolChoice,
                    canonicalName: TOOL_CHOICE_PARAM_CANONICAL_NAME,
                  },
                ]
              : []
          ),
        instance.model.provider,
        instance.model.modelName
      ),
      instance.model.supportedInvocationParameters
    ),
  } satisfies Partial<ChatPromptVersionInput>;
  return newPromptVersion;
};

const fetchPlaygroundPromptQuery = graphql`
  query fetchPlaygroundPromptQuery($promptId: ID!) {
    prompt: node(id: $promptId) {
      ... on Prompt {
        id
        name
        createdAt
        description
        version {
          id
          description
          modelName
          modelProvider
          invocationParameters
          templateType
          templateFormat
          responseFormat {
            definition
          }
          template {
            __typename
            ... on PromptChatTemplate {
              messages {
                role
                content {
                  __typename
                  ... on TextContentPart {
                    text {
                      text
                    }
                  }
                  ... on ToolCallContentPart {
                    toolCall {
                      toolCallId
                      toolCall {
                        name
                        arguments
                      }
                    }
                  }
                  ... on ToolResultContentPart {
                    toolResult {
                      toolCallId
                      result
                    }
                  }
                }
              }
            }
          }
          tools {
            definition
          }
        }
      }
    }
  }
`;

const supportedInvocationParametersQuery = graphql`
  query fetchPlaygroundPromptSupportedInvocationParametersQuery(
    $modelsInput: ModelsInput!
  ) {
    modelInvocationParameters(input: $modelsInput) {
      __typename
      ... on InvocationParameterBase {
        invocationName
        canonicalName
        required
        label
      }
      # defaultValue must be aliased because Relay will not create a union type for fields with the same name
      # follow the naming convention of the field type e.g. floatDefaultValue for FloatInvocationParameter
      # default value mapping elsewhere in playground code relies on this naming convention
      # https://github.com/facebook/relay/issues/3776
      ... on BooleanInvocationParameter {
        booleanDefaultValue: defaultValue
        invocationInputField
      }
      ... on BoundedFloatInvocationParameter {
        floatDefaultValue: defaultValue
        invocationInputField
        minValue
        maxValue
      }
      ... on FloatInvocationParameter {
        floatDefaultValue: defaultValue
        invocationInputField
      }
      ... on IntInvocationParameter {
        intDefaultValue: defaultValue
        invocationInputField
      }
      ... on JSONInvocationParameter {
        jsonDefaultValue: defaultValue
        invocationInputField
      }
      ... on StringInvocationParameter {
        stringDefaultValue: defaultValue
        invocationInputField
      }
      ... on StringListInvocationParameter {
        stringListDefaultValue: defaultValue
        invocationInputField
      }
    }
  }
`;

/**
 * Fetches the supported invocation parameters for a model.
 *
 * @param modelName - The model name
 * @param providerKey - The provider key
 * @returns The supported invocation parameters
 */
const fetchSupportedInvocationParameters = async ({
  modelName,
  providerKey,
}: {
  modelName: string;
  providerKey?: GenerativeProviderKey | null;
}) => {
  const supportedInvocationParametersResponse =
    await fetchQuery<fetchPlaygroundPromptSupportedInvocationParametersQuery>(
      RelayEnvironment,
      supportedInvocationParametersQuery,
      {
        modelsInput: {
          modelName,
          providerKey,
        },
      }
    ).toPromise();

  const supportedInvocationParameters =
    supportedInvocationParametersResponse?.modelInvocationParameters as
      | Mutable<
          NonNullable<
            typeof supportedInvocationParametersResponse
          >["modelInvocationParameters"]
        >
      | undefined;

  return supportedInvocationParameters;
};

/**
 * Fetches a prompt by ID.
 *
 * @param promptId - The prompt ID
 * @returns The prompt
 */
export const fetchPlaygroundPrompt = async (promptId: string) => {
  return fetchQuery<fetchPlaygroundPromptQuery>(
    RelayEnvironment,
    fetchPlaygroundPromptQuery,
    {
      promptId,
    }
  ).toPromise();
};

/**
 * Gets the latest prompt version from a prompt.
 *
 * @param prompt - The prompt
 * @returns The latest prompt version
 */
const getLatestPromptVersion = (
  prompt?: fetchPlaygroundPromptQuery$data["prompt"]
) => {
  if (!prompt) {
    return null;
  }
  return prompt?.version as Mutable<PromptVersion> | null;
};

/**
 * Fetches a prompt by ID and converts it to a playground instance.
 *
 * @param promptId - The prompt ID
 * @returns The playground instance
 */
export const fetchPlaygroundPromptAsInstance = async (
  promptId?: string | null
) => {
  if (!promptId) {
    return null;
  }
  const response = await fetchPlaygroundPrompt(promptId);
  const latestPromptVersion = getLatestPromptVersion(response?.prompt);
  if (latestPromptVersion && latestPromptVersion.templateType === "CHAT") {
    const supportedInvocationParameters =
      await fetchSupportedInvocationParameters({
        modelName: latestPromptVersion.modelName,
        providerKey: latestPromptVersion.modelProvider,
      });
    const promptName = response?.prompt?.name;
    if (!promptName) {
      throw new Error("Prompt name is required");
    }
    const newInstance = promptVersionToInstance({
      promptId,
      promptName,
      promptVersion: latestPromptVersion,
      supportedInvocationParameters,
    });
    return { instance: newInstance, promptVersion: latestPromptVersion };
  }
  return null;
};
