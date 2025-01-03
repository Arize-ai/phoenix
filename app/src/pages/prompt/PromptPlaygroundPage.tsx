import React, { useMemo } from "react";
import { useFragment } from "react-relay";
import { graphql } from "relay-runtime";

import { DEFAULT_MODEL_PROVIDER } from "@phoenix/constants/generativeConstants";
import {
  createPlaygroundInstance,
  generateMessageId,
  generateToolId,
} from "@phoenix/store";
import { Mutable } from "@phoenix/typeUtils";

import { Playground } from "../playground/Playground";
import {
  getChatRole,
  openInferenceModelProviderToPhoenixModelProvider,
} from "../playground/playgroundUtils";

import {
  PromptPlaygroundPage__main$data,
  PromptPlaygroundPage__main$key,
} from "./__generated__/PromptPlaygroundPage__main.graphql";
import { usePromptIdLoader } from "./usePromptIdLoader";

const getLatestPromptVersion = (data: PromptPlaygroundPage__main$data) => {
  return data.promptVersions.edges[0].promptVersion as Mutable<
    PromptPlaygroundPage__main$data["promptVersions"]["edges"][0]["promptVersion"]
  >;
};

export function PromptPlaygroundPage() {
  const { prompt } = usePromptIdLoader();
  const data = useFragment<PromptPlaygroundPage__main$key>(
    graphql`
      fragment PromptPlaygroundPage__main on Prompt {
        id
        name
        createdAt
        description
        promptVersions {
          edges {
            promptVersion: node {
              id
              description
              modelName
              modelProvider
              invocationParameters
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
    `,
    prompt
  );

  // we over-fetch the prompt versions in the fragment,
  // so we extract the latest prompt version for use in the playground
  const latestPromptVersion = useMemo(
    () => getLatestPromptVersion(data),
    [data]
  );

  // create a playground instance with the prompt details configured
  // When the playground component mounts and sees the prompt id in the instance,
  // it should automatically load the prompt into the instance
  const playgroundInstance = useMemo(() => {
    let instance = createPlaygroundInstance();
    instance = {
      ...instance,
      model: {
        ...instance.model,
        modelName: latestPromptVersion.modelName,
        provider:
          openInferenceModelProviderToPhoenixModelProvider(
            latestPromptVersion.modelProvider
          ) || DEFAULT_MODEL_PROVIDER,
      },
      template: {
        __type: "chat",
        messages:
          "messages" in latestPromptVersion.template
            ? latestPromptVersion.template.messages.map((m) => ({
                ...m,
                id: generateMessageId(),
                role: getChatRole(m.role?.toLocaleLowerCase() as string),
              }))
            : [],
      },
      tools: latestPromptVersion.tools.map((t) => ({
        id: generateToolId(),
        definition: t.definition,
      })),
      // @TODO(apowell): Parse invocation parameters from the prompt version
      prompt: {
        id: prompt.id,
      },
    };
    return instance;
  }, [latestPromptVersion, prompt]);

  return (
    <Playground
      // remount the playground when the prompt changes, reinitializing the store
      key={prompt.id}
      instances={[playgroundInstance]}
    />
  );
}
