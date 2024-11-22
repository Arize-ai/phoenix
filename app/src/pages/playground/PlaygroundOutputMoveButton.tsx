import React from "react";

import {
  Button,
  Icon,
  Icons,
  Tooltip,
  TooltipTrigger,
} from "@arizeai/components";

import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";
import {
  ChatMessage,
  generateMessageId,
  PlaygroundInstance,
} from "@phoenix/store";
import { safelyParseJSON } from "@phoenix/utils/jsonUtils";

import { PartialOutputToolCall } from "./PlaygroundToolCall";
import {
  convertMessageToolCallsToProvider,
  getChatRole,
} from "./playgroundUtils";

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
        variant="default"
        size="compact"
        icon={<Icon svg={<Icons.PlusCircleOutline />} />}
        onClick={(e) => {
          e.stopPropagation();
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
      />
      <Tooltip>Move Output message to the end of Prompt</Tooltip>
    </TooltipTrigger>
  );
};
