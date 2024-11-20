import React from "react";
import { graphql, useLazyLoadQuery } from "react-relay";
import { css, keyframes } from "@emotion/react";

import { Button, Flex, Icon, Icons } from "@arizeai/components";

import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";
import {
  createOpenAIResponseFormat,
  generateMessageId,
  PlaygroundInstance,
} from "@phoenix/store";

import { PlaygroundChatTemplateFooterResponseFormatQuery } from "./__generated__/PlaygroundChatTemplateFooterResponseFormatQuery.graphql";
import {
  RESPONSE_FORMAT_PARAM_CANONICAL_NAME,
  RESPONSE_FORMAT_PARAM_NAME,
  TOOL_CHOICE_PARAM_CANONICAL_NAME,
  TOOL_CHOICE_PARAM_NAME,
} from "./constants";
import {
  areInvocationParamsEqual,
  createToolForProvider,
} from "./playgroundUtils";

type PlaygroundChatTemplateFooterProps = {
  instanceId: number;
  hasResponseFormat: boolean;
};

const FOOTER_MIN_HEIGHT = 32;

export function PlaygroundChatTemplateFooter({
  instanceId,
  hasResponseFormat,
}: PlaygroundChatTemplateFooterProps) {
  const instances = usePlaygroundContext((state) => state.instances);
  const updateInstance = usePlaygroundContext((state) => state.updateInstance);
  const upsertInvocationParameterInput = usePlaygroundContext(
    (state) => state.upsertInvocationParameterInput
  );
  const playgroundInstance = instances.find(
    (instance) => instance.id === instanceId
  );
  if (!playgroundInstance) {
    throw new Error(`Playground instance ${instanceId} not found`);
  }
  const { template } = playgroundInstance;
  if (template.__type !== "chat") {
    throw new Error(`Invalid template type ${template.__type}`);
  }

  // We don't care about the model name for Azure OpenAI
  const modelNameQueryInput =
    playgroundInstance.model.provider !== "AZURE_OPENAI"
      ? (playgroundInstance.model?.modelName ?? null)
      : null;
  const { modelInvocationParameters } =
    useLazyLoadQuery<PlaygroundChatTemplateFooterResponseFormatQuery>(
      graphql`
        query PlaygroundChatTemplateFooterResponseFormatQuery(
          $input: ModelsInput!
        ) {
          modelInvocationParameters(input: $input) {
            __typename
            ... on InvocationParameterBase {
              invocationName
              canonicalName
            }
          }
        }
      `,
      {
        input: {
          providerKey: playgroundInstance.model.provider,
          modelName: modelNameQueryInput,
        },
      }
    );

  const supportsResponseFormat = modelInvocationParameters?.some((p) =>
    areInvocationParamsEqual(p, {
      canonicalName: RESPONSE_FORMAT_PARAM_CANONICAL_NAME,
      invocationName: RESPONSE_FORMAT_PARAM_NAME,
    })
  );
  const supportsToolChoice = modelInvocationParameters?.some((p) =>
    areInvocationParamsEqual(p, {
      canonicalName: TOOL_CHOICE_PARAM_CANONICAL_NAME,
      invocationName: TOOL_CHOICE_PARAM_NAME,
    })
  );
  return (
    <Flex
      direction="row"
      justifyContent="end"
      gap="size-100"
      minHeight={FOOTER_MIN_HEIGHT}
    >
      {supportsResponseFormat ? (
        <Button
          variant="default"
          size="compact"
          aria-label="output schema"
          icon={<Icon svg={<Icons.PlusOutline />} />}
          disabled={hasResponseFormat}
          onClick={() => {
            upsertInvocationParameterInput({
              instanceId,
              invocationParameterInput: {
                valueJson: createOpenAIResponseFormat(),
                invocationName: RESPONSE_FORMAT_PARAM_NAME,
                canonicalName: RESPONSE_FORMAT_PARAM_CANONICAL_NAME,
              },
            });
          }}
        >
          Output Schema
        </Button>
      ) : null}
      {supportsToolChoice ? (
        <Button
          variant="default"
          aria-label="add tool"
          size="compact"
          icon={<Icon svg={<Icons.PlusOutline />} />}
          onClick={() => {
            const patch: Partial<PlaygroundInstance> = {
              tools: [
                ...playgroundInstance.tools,
                createToolForProvider({
                  provider: playgroundInstance.model.provider,
                  toolNumber: playgroundInstance.tools.length + 1,
                }),
              ],
            };
            if (playgroundInstance.tools.length === 0) {
              patch.toolChoice = "auto";
            }
            updateInstance({
              instanceId,
              patch: {
                tools: [
                  ...playgroundInstance.tools,
                  createToolForProvider({
                    provider: playgroundInstance.model.provider,
                    toolNumber: playgroundInstance.tools.length + 1,
                  }),
                ],
              },
            });
          }}
        >
          Tool
        </Button>
      ) : null}
      <Button
        variant="default"
        aria-label="add message"
        size="compact"
        icon={<Icon svg={<Icons.PlusOutline />} />}
        onClick={() => {
          updateInstance({
            instanceId,
            patch: {
              template: {
                __type: "chat",
                messages: [
                  ...template.messages,
                  {
                    id: generateMessageId(),
                    role: "user",
                    content: "",
                  },
                ],
              },
            },
          });
        }}
      >
        Message
      </Button>
    </Flex>
  );
}

const pulse = keyframes`
  0% {
    opacity: 0;
  }
  50% {
    opacity: 0.1;
  }
  100% {
    opacity: 0;
  }
`;

const loadingStyles = css`
  background-color: var(--ac-global-color-gray-100);
  animation: ${pulse} 1.7s infinite ease-in-out;
  width: 100%;
  height: 100%;
  border-radius: 4px;
`;

export function PlaygroundChatTemplateFooterFallback() {
  return (
    <Flex minHeight={FOOTER_MIN_HEIGHT} width="100%" height={FOOTER_MIN_HEIGHT}>
      <div css={loadingStyles}></div>
    </Flex>
  );
}
