import React from "react";

import { Icon, Icons, Tooltip, TooltipTrigger } from "@arizeai/components";

import { Button } from "@phoenix/components";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";
import {
  ChatMessage,
  generateMessageId,
  PlaygroundInstance,
} from "@phoenix/store";
import { convertMessageToolCallsToProvider } from "@phoenix/store/playground/playgroundStoreUtils";
import { safelyParseJSON } from "@phoenix/utils/jsonUtils";

import { PartialOutputToolCall } from "./PlaygroundToolCall";
import { getChatRole } from "./playgroundUtils";

export const PlaygroundOutputMoveButton = ({
  instance,
  outputContent,
  toolCalls,
  cleanupOutput,
}: {
  instance: PlaygroundInstance;
  outputContent?: string | ChatMessage[];
  toolCalls: PartialOutputToolCall[];
  cleanupOutput: () => void;
}) => {
  const instanceId = instance.id;
  const updateInstance = usePlaygroundContext((state) => state.updateInstance);
  return (
    <TooltipTrigger delay={500} offset={10}>
      <Button
        size="S"
        icon={<Icon svg={<Icons.PlusCircleOutline />} />}
        aria-label="Move the output message to the end of the prompt"
        onPress={() => {
          if (instance.template.__type !== "chat") {
            return;
          }
          const messages = Array.isArray(outputContent)
            ? outputContent
            : outputContent
              ? [
                  {
                    id: generateMessageId(),
                    role: getChatRole("ai"),
                    content: outputContent,
                  },
                ]
              : [];
          if (toolCalls.length > 0) {
            messages.push({
              id: generateMessageId(),
              role: getChatRole("ai"),
              toolCalls: convertMessageToolCallsToProvider({
                provider: instance.model.provider,
                toolCalls: toolCalls.map((tc) => ({
                  ...tc,
                  function: {
                    ...tc.function,
                    arguments:
                      safelyParseJSON(tc.function.arguments)?.json ??
                      tc.function.arguments,
                  },
                })),
              }),
            });
          }
          updateInstance({
            instanceId,
            patch: {
              template: {
                __type: "chat",
                messages: [...instance.template.messages, ...messages],
              },
            },
          });
          cleanupOutput();
        }}
      >
        Prompt
      </Button>
      <Tooltip>Move the output message to the end of the prompt</Tooltip>
    </TooltipTrigger>
  );
};
