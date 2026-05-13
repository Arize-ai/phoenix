import { fetchQuery, graphql, readInlineData } from "react-relay";

import { DEFAULT_MODEL_NAME } from "@phoenix/constants/generativeConstants";
import type { fetchPlaygroundPrompt_promptVersionToInstance_promptVersion$key } from "@phoenix/pages/playground/__generated__/fetchPlaygroundPrompt_promptVersionToInstance_promptVersion.graphql";
import type { ChatPromptVersionInput } from "@phoenix/pages/playground/__generated__/UpsertPromptFromTemplateDialogCreateMutation.graphql";
import { buildPromptVersionInput } from "@phoenix/pages/playground/playgroundUtils";
import { buildPlaygroundInstanceFieldsFromPromptConfig } from "@phoenix/pages/playground/promptConfigToPlaygroundInstance";
import RelayEnvironment from "@phoenix/RelayEnvironment";
import type { PlaygroundInstance } from "@phoenix/store/playground";
import { DEFAULT_INSTANCE_PARAMS } from "@phoenix/store/playground";
import {
  makeTextPart,
  makeToolCallPart,
  makeToolResultPart,
} from "@phoenix/utils/promptUtils";

import type {
  fetchPlaygroundPromptQuery as fetchPlaygroundPromptQueryType,
  PromptMessageRole,
} from "./__generated__/fetchPlaygroundPromptQuery.graphql";

import "./PromptInvocationParametersReadableFragment";

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
 * @param promptVersionRef - Prompt version fragment reference
 * @returns The playground instance
 */
export const promptVersionToInstance = ({
  promptId,
  promptName,
  promptVersionRef,
  promptVersionTag,
}: {
  promptId: string;
  promptName: string;
  promptVersionRef: fetchPlaygroundPrompt_promptVersionToInstance_promptVersion$key;
  promptVersionTag: string | null;
}) => {
  const promptVersion = readInlineData(
    graphql`
      fragment fetchPlaygroundPrompt_promptVersionToInstance_promptVersion on PromptVersion
      @inline {
        id
        modelName
        modelProvider
        invocationParameters {
          ...PromptInvocationParametersReadableFragment
        }
        customProvider {
          id
          name
        }
        responseFormat {
          jsonSchema {
            name
            description
            schema
            strict
          }
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
          ... on PromptStringTemplate {
            template
          }
        }
        tools {
          tools {
            __typename
            ... on PromptToolFunction {
              function {
                name
                description
                parameters
                strict
              }
            }
            ... on PromptToolRaw {
              raw
            }
          }
          toolChoice {
            type
            functionName
          }
          disableParallelToolCalls
        }
      }
    `,
    promptVersionRef
  );
  const newInstance = {
    ...DEFAULT_INSTANCE_PARAMS(),
    prompt: {
      id: promptId,
      name: promptName,
      version: promptVersion.id,
      tag: promptVersionTag,
    },
    selectedRepetitionNumber: 1,
  } satisfies Partial<PlaygroundInstance>;

  const modelName = promptVersion.modelName;
  const provider = promptVersion.modelProvider;
  const instanceFields = buildPlaygroundInstanceFieldsFromPromptConfig({
    provider,
    modelName,
    template: promptVersion.template,
    tools: promptVersion.tools,
    invocationParametersRef: promptVersion.invocationParameters,
    responseFormat: promptVersion.responseFormat,
    customProvider: promptVersion.customProvider
      ? {
          id: promptVersion.customProvider.id,
          name: promptVersion.customProvider.name,
        }
      : null,
  });
  return {
    ...newInstance,
    model: {
      ...newInstance.model,
      ...instanceFields.model,
    },
    template: instanceFields.template,
    tools: instanceFields.tools,
    toolChoice: instanceFields.toolChoice,
  } satisfies Omit<PlaygroundInstance, "id">;
};

/**
 * Converts a playground instance to a prompt version.
 *
 * @todo(apowell): The output may be better suited as PromptCreateInput
 */
export const instanceToPromptVersion = ({
  instance,
  templateFormat,
}: {
  instance: PlaygroundInstance;
  templateFormat: ChatPromptVersionInput["templateFormat"];
}) => {
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

  // The canonical config in the store is already normalized — the adapter's
  // `normalize` (called by every writeField) enforces field-rippling
  // invariants, and `writeField` rejects NaN. `buildPromptVersionInput` calls
  // `invocationConfigToPromptInput` which handles provider-specific
  // serialization (e.g., OpenAI's zero-value drop for frequency/presence
  // penalty). No row trip needed.
  return buildPromptVersionInput({
    instance,
    modelName: instance.model.modelName || DEFAULT_MODEL_NAME,
    templateFormat,
    promptMessages: templateMessages,
    invocationParameters: instance.model.invocationParameters,
  });
};

const fetchPlaygroundPromptQuery = graphql`
  query fetchPlaygroundPromptQuery(
    $promptId: ID!
    $promptVersionId: ID
    $tagName: Identifier
  ) {
    prompt: node(id: $promptId) {
      ... on Prompt {
        id
        name
        createdAt
        description
        version(versionId: $promptVersionId, tagName: $tagName) {
          ...fetchPlaygroundPrompt_promptVersionToInstance_promptVersion
          id
          description
          modelName
          modelProvider
          invocationParameters {
            ...PromptInvocationParametersReadableFragment
          }
          templateType
          templateFormat
          tags {
            name
            promptVersionId
          }
          responseFormat {
            jsonSchema {
              name
              description
              schema
              strict
            }
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
            tools {
              __typename
              ... on PromptToolFunction {
                function {
                  name
                  description
                  parameters
                  strict
                }
              }
              ... on PromptToolRaw {
                raw
              }
            }
            toolChoice {
              type
              functionName
            }
            disableParallelToolCalls
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
export const fetchPlaygroundPrompt = async ({
  promptId,
  promptVersionId,
  tagName,
}: {
  promptId: string;
  promptVersionId?: string | null;
  tagName?: string | null;
}) => {
  return fetchQuery<fetchPlaygroundPromptQueryType>(
    RelayEnvironment,
    fetchPlaygroundPromptQuery,
    {
      promptId,
      promptVersionId,
      tagName,
    }
  ).toPromise();
};

/**
 * Fetches a prompt by ID, and optionally a specific version or tag, and converts it to a playground instance.
 *
 * @returns The playground instance
 */
export const fetchPlaygroundPromptAsInstance = async ({
  promptId,
  promptVersionId,
  tagName,
}: {
  /**
   * The prompt version ID to fetch specifically. If not provided, the latest version or tagged version will be used.
   */
  promptVersionId?: string | null;
  /**
   * Prompt version with the associated tag name. Will be ignored if promptVersionId is provided.
   */
  tagName?: string | null;
  /**
   * The prompt ID. Required if providing a version or tag.
   */
  promptId?: string | null;
}) => {
  if (!promptId) {
    return null;
  }
  const response = await fetchPlaygroundPrompt({
    promptId,
    promptVersionId,
    tagName,
  });
  const latestPromptVersion = response?.prompt?.version ?? null;
  if (latestPromptVersion && latestPromptVersion.templateType === "CHAT") {
    const promptName = response?.prompt?.name;
    if (!promptName) {
      throw new Error("Prompt name is required");
    }
    const newInstance = promptVersionToInstance({
      promptId,
      promptName,
      promptVersionRef: latestPromptVersion,
      promptVersionTag: tagName || null,
    });
    return { instance: newInstance, promptVersion: latestPromptVersion };
  }
  return null;
};
