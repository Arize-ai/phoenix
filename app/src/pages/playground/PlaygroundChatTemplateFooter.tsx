import React from "react";

import { Flex } from "@arizeai/components";

import { Button, Icon, Icons } from "@phoenix/components";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";
import {
  createOpenAIResponseFormat,
  generateMessageId,
  PlaygroundInstance,
} from "@phoenix/store";

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

  const supportedModelInvocationParameters =
    playgroundInstance.model.supportedInvocationParameters;

  const supportsResponseFormat = supportedModelInvocationParameters?.some((p) =>
    areInvocationParamsEqual(p, {
      canonicalName: RESPONSE_FORMAT_PARAM_CANONICAL_NAME,
      invocationName: RESPONSE_FORMAT_PARAM_NAME,
    })
  );
  const supportsToolChoice = supportedModelInvocationParameters?.some((p) =>
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
          size="S"
          aria-label="output schema"
          icon={<Icon svg={<Icons.PlusOutline />} />}
          isDisabled={hasResponseFormat}
          onPress={() => {
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
          aria-label="add tool"
          size="S"
          icon={<Icon svg={<Icons.PlusOutline />} />}
          onPress={() => {
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
        aria-label="add message"
        size="S"
        icon={<Icon svg={<Icons.PlusOutline />} />}
        onPress={() => {
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
