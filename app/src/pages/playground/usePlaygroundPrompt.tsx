import { useEffect } from "react";
import { graphql, usePreloadedQuery, useQueryLoader } from "react-relay";

import {
  DEFAULT_MODEL_NAME,
  DEFAULT_MODEL_PROVIDER,
} from "@phoenix/constants/generativeConstants";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";
import {
  getChatRole,
  openInferenceModelProviderToPhoenixModelProvider,
} from "@phoenix/pages/playground/playgroundUtils";
import {
  DEFAULT_INSTANCE_PARAMS,
  generateMessageId,
  generateToolId,
  PlaygroundInstance,
} from "@phoenix/store/playground";
import { Mutable } from "@phoenix/typeUtils";

import {
  PromptMessageRole,
  usePlaygroundPromptQuery,
  usePlaygroundPromptQuery$data,
} from "./__generated__/usePlaygroundPromptQuery.graphql";

type PromptVersion = NonNullable<
  usePlaygroundPromptQuery$data["prompt"]["promptVersions"]
>["edges"][0]["promptVersion"];

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

export const promptVersionToInstance = (promptVersion: PromptVersion) => {
  const newInstance = {
    ...DEFAULT_INSTANCE_PARAMS(),
    prompt: { id: promptVersion.id },
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
  prompt: usePlaygroundPromptQuery$data["prompt"]
) => {
  if (!prompt) {
    return null;
  }
  return prompt?.promptVersions?.edges?.[0]
    ?.promptVersion as Mutable<PromptVersion> | null;
};

const query = graphql`
  query usePlaygroundPromptQuery($promptId: GlobalID!) {
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

export const usePlaygroundPromptReference = (instanceId: number) => {
  const instances = usePlaygroundContext((state) => state.instances);
  const instance = instances.find((instance) => instance.id === instanceId);
  if (!instance) {
    throw new Error(`Instance ${instanceId} not found`);
  }
  const promptId = instance.prompt?.id;
  const [queryReference, loadQuery, disposeQuery] =
    useQueryLoader<usePlaygroundPromptQuery>(query);

  useEffect(() => {
    if (promptId) {
      loadQuery({ promptId: promptId });
      return () => disposeQuery();
    }
  }, [disposeQuery, loadQuery, promptId]);

  return queryReference;
};

export type PromptQueryReference = NonNullable<
  ReturnType<typeof useQueryLoader<usePlaygroundPromptQuery>>[0]
>;

export const usePlaygroundPrompt = (
  instanceId: number,
  queryReference: PromptQueryReference
) => {
  const updateInstance = usePlaygroundContext((state) => state.updateInstance);
  const instances = usePlaygroundContext((state) => state.instances);
  const instance = instances.find((instance) => instance.id === instanceId);
  if (!instance) {
    throw new Error(`Instance ${instanceId} not found`);
  }
  const { prompt } = usePreloadedQuery(query, queryReference);

  useEffect(() => {
    const latestPromptVersion = getLatestPromptVersion(prompt);
    if (latestPromptVersion && latestPromptVersion.templateType === "CHAT") {
      const newInstance = promptVersionToInstance(latestPromptVersion);
      updateInstance({
        instanceId,
        patch: {
          ...newInstance,
        },
      });
    }
  }, [instanceId, prompt, updateInstance]);
};
