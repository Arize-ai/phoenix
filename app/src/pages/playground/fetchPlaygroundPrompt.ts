import { fetchQuery, graphql } from "react-relay";

import {
  DEFAULT_MODEL_NAME,
  DEFAULT_MODEL_PROVIDER,
} from "@phoenix/constants/generativeConstants";
import {
  getChatRole,
  openInferenceModelProviderToPhoenixModelProvider,
} from "@phoenix/pages/playground/playgroundUtils";
import RelayEnvironment from "@phoenix/RelayEnvironment";
import {
  DEFAULT_INSTANCE_PARAMS,
  generateMessageId,
  generateToolId,
  PlaygroundInstance,
} from "@phoenix/store/playground";
import { Mutable } from "@phoenix/typeUtils";

import {
  fetchPlaygroundPromptQuery,
  fetchPlaygroundPromptQuery$data,
  PromptMessageRole,
} from "./__generated__/fetchPlaygroundPromptQuery.graphql";

type PromptVersion = NonNullable<
  fetchPlaygroundPromptQuery$data["prompt"]["promptVersions"]
>["edges"][0]["promptVersion"];

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
 * Converts a prompt version to a playground instance.
 *
 * The playground instance is missing an id, it will need to be generated before usage.
 *
 * @param promptId - The prompt ID
 * @param promptVersion - The prompt version
 * @returns The playground instance
 */
export const promptVersionToInstance = (
  promptId: string,
  promptVersion: PromptVersion
) => {
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
    },
    template: {
      __type: "chat",
      messages:
        "messages" in promptVersion.template
          ? promptVersion.template.messages.map((m) => ({
              ...m,
              id: generateMessageId(),
              role: getChatRole(m.role?.toLocaleLowerCase() as string),
            }))
          : [],
    },
    tools: promptVersion.tools.map((t) => ({
      id: generateToolId(),
      definition: t.definition,
    })),
  } satisfies Partial<PlaygroundInstance>;
};

/**
 * Converts a playground instance to a prompt version.
 *
 * @todo(apowell): The output may be better suited as PromptCreateInput
 *
 * @param instance - The playground instance
 * @returns The prompt version
 */
export const instanceToPromptVersion = (instance: PlaygroundInstance) => {
  if (!instance.prompt) {
    return null;
  }
  if (instance.template.__type === "text_completion") {
    // eslint-disable-next-line no-console
    console.warn(
      "Instance to prompt version conversion not supported for text completion"
    );
    return null;
  }
  return {
    id: instance.prompt.id,
    modelName: instance.model.modelName || DEFAULT_MODEL_NAME,
    modelProvider: instance.model.provider,
    templateType: "CHAT",
    template: {
      __typename: "PromptChatTemplate",
      messages: instance.template.messages.map((m) => ({
        content: m.content,
        role: chatMessageRoleToPromptMessageRole(m.role),
      })),
    },
    tools: instance.tools.map((t) => ({
      __typename: "ToolDefinition",
      definition: t.definition,
    })),
    // @TODO(apowell): Add description and invocationParameters
  } satisfies Partial<PromptVersion>;
};

const getLatestPromptVersion = (
  prompt?: fetchPlaygroundPromptQuery$data["prompt"]
) => {
  if (!prompt) {
    return null;
  }
  return prompt?.promptVersions?.edges?.[0]
    ?.promptVersion as Mutable<PromptVersion> | null;
};

const query = graphql`
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
              template {
                __typename
                ... on PromptChatTemplate {
                  messages {
                    ... on TextPromptMessage {
                      content
                      role
                    }
                  }
                }
              }
              tools {
                __typename
                definition
              }
            }
          }
        }
      }
    }
  }
`;

/**
 * Fetches a prompt by ID.
 *
 * @param promptId - The prompt ID
 * @returns The prompt
 */
export const fetchPlaygroundPrompt = async (promptId: string) => {
  return fetchQuery<fetchPlaygroundPromptQuery>(RelayEnvironment, query, {
    promptId,
  }).toPromise();
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
    const newInstance = promptVersionToInstance(promptId, latestPromptVersion);
    return newInstance;
  }
  return null;
};
