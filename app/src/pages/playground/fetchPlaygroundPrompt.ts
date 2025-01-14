import { fetchQuery, graphql } from "react-relay";

import {
  DEFAULT_MODEL_NAME,
  DEFAULT_MODEL_PROVIDER,
} from "@phoenix/constants/generativeConstants";
import { fetchPlaygroundPromptSupportedInvocationParametersQuery } from "@phoenix/pages/playground/__generated__/fetchPlaygroundPromptSupportedInvocationParametersQuery.graphql";
import { GenerativeProviderKey } from "@phoenix/pages/playground/__generated__/ModelSupportedParamsFetcherQuery.graphql";
import {
  RESPONSE_FORMAT_PARAM_CANONICAL_NAME,
  RESPONSE_FORMAT_PARAM_NAME,
  TOOL_CHOICE_PARAM_CANONICAL_NAME,
  TOOL_CHOICE_PARAM_NAME,
} from "@phoenix/pages/playground/constants";
import {
  areInvocationParamsEqual,
  getChatRole,
  openInferenceModelProviderToPhoenixModelProvider,
  toCamelCase,
} from "@phoenix/pages/playground/playgroundUtils";
import RelayEnvironment from "@phoenix/RelayEnvironment";
import {
  DEFAULT_INSTANCE_PARAMS,
  generateMessageId,
  generateToolId,
  PlaygroundInstance,
} from "@phoenix/store/playground";
import { isObject, Mutable } from "@phoenix/typeUtils";

import {
  fetchPlaygroundPromptQuery,
  fetchPlaygroundPromptQuery$data,
  PromptMessageRole,
} from "./__generated__/fetchPlaygroundPromptQuery.graphql";

type PromptVersion = NonNullable<
  fetchPlaygroundPromptQuery$data["prompt"]["promptVersions"]
>["edges"][0]["promptVersion"];

export const isTextPart = (
  part: unknown
): part is { text: string; type: "text" } =>
  isObject(part) && "text" in part && "type" in part && part.type === "text";

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
  promptVersion,
  supportedInvocationParameters,
}: {
  promptId: string;
  promptVersion: PromptVersion;
  supportedInvocationParameters?: PlaygroundInstance["model"]["supportedInvocationParameters"];
}) => {
  const newInstance = {
    ...DEFAULT_INSTANCE_PARAMS(),
    prompt: { id: promptId },
  } satisfies Partial<PlaygroundInstance>;

  return {
    ...newInstance,
    model: {
      ...newInstance.model,
      modelName: promptVersion.modelName,
      provider:
        openInferenceModelProviderToPhoenixModelProvider(
          promptVersion.modelProvider
        ) || DEFAULT_MODEL_PROVIDER,
      supportedInvocationParameters: supportedInvocationParameters || [],
      invocationParameters: objectToInvocationParameters(
        {
          ...promptVersion.invocationParameters,
          ...(promptVersion.outputSchema?.definition
            ? {
                response_format: promptVersion.outputSchema.definition,
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
              const maybeTextPart = m.content.find(isTextPart);
              if (isTextPart(maybeTextPart)) {
                return {
                  id: generateMessageId(),
                  role: getChatRole(m.role?.toLocaleLowerCase() as string),
                  content: maybeTextPart.text,
                };
              }
              // TODO(apowell): Break out into switch statement, rendering each message part type
              return {
                id: generateMessageId(),
                role: getChatRole(m.role?.toLocaleLowerCase() as string),
                content: "",
              };
            })
          : [],
    },
    tools: promptVersion.tools.map((t) => ({
      id: generateToolId(),
      definition: t.definition,
    })),
    toolChoice: promptVersion.invocationParameters?.tool_choice || undefined,
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

  return {
    modelName: instance.model.modelName || DEFAULT_MODEL_NAME,
    modelProvider: instance.model.provider,
    templateType: "CHAT",
    template: {
      messages: instance.template.messages.map((m) => ({
        content: m.content || "",
        role: chatMessageRoleToPromptMessageRole(m.role),
      })),
    },
    tools: instance.tools.map((tool) => ({
      definition: tool.definition,
    })),
    outputSchema:
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
      instance.model.supportedInvocationParameters
    ),
  } satisfies Omit<Partial<PromptVersion>, "template" | "tools"> & {
    template: Omit<Partial<PromptVersion["template"]>, "__typename">;
  } & { tools: Omit<Partial<PromptVersion["tools"]>[number], "__typename"> };
};

const fetchPlaygroundPromptQuery = graphql`
  query fetchPlaygroundPromptQuery($promptId: GlobalID!) {
    prompt: node(id: $promptId) {
      ... on Prompt {
        id
        name
        createdAt
        description
        promptVersions(first: 1) {
          edges {
            promptVersion: node {
              id
              description
              modelName
              modelProvider
              invocationParameters
              templateType
              templateFormat
              outputSchema {
                definition
              }
              template {
                __typename
                ... on PromptChatTemplate {
                  messages {
                    role
                    content {
                      __typename
                      ... on ImagePart {
                        type
                        image {
                          type
                          url
                        }
                      }
                      ... on TextPart {
                        type
                        text
                      }
                      ... on ToolCallPart {
                        type
                        toolCall
                      }
                      ... on ToolResultPart {
                        type
                        toolResult {
                          type
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
  return prompt?.promptVersions?.edges?.[0]
    ?.promptVersion as Mutable<PromptVersion> | null;
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
        providerKey: openInferenceModelProviderToPhoenixModelProvider(
          latestPromptVersion.modelProvider
        ),
      });
    const newInstance = promptVersionToInstance({
      promptId,
      promptVersion: latestPromptVersion,
      supportedInvocationParameters,
    });
    return { instance: newInstance, promptVersion: latestPromptVersion };
  }
  return null;
};
