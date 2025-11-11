import {
  Button,
  Icon,
  Icons,
  Tooltip,
  TooltipArrow,
  TooltipTrigger,
} from "@phoenix/components";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";
import {
  ChatMessage,
  generateMessageId,
  PlaygroundNormalizedInstance,
} from "@phoenix/store";
import { convertMessageToolCallsToProvider } from "@phoenix/store/playground/playgroundStoreUtils";
import { safelyParseJSON } from "@phoenix/utils/jsonUtils";

import { PartialOutputToolCall } from "./PlaygroundToolCall";
import { getChatRole } from "./playgroundUtils";

export const PlaygroundOutputMoveButton = ({
  instance,
  output,
  toolCalls,
  cleanupOutput,
  isDisabled,
}: {
  instance: PlaygroundNormalizedInstance;
  output?: string | ChatMessage[] | null | undefined;
  toolCalls: PartialOutputToolCall[];
  cleanupOutput: () => void;
  isDisabled: boolean;
}) => {
  const instanceId = instance.id;
  const addMessage = usePlaygroundContext((state) => state.addMessage);
  return (
    <TooltipTrigger delay={500}>
      <Button
        size="S"
        isDisabled={isDisabled}
        leadingVisual={<Icon svg={<Icons.PlusCircleOutline />} />}
        aria-label="Move the output message to the end of the prompt"
        onPress={() => {
          if (instance.template.__type !== "chat") {
            return;
          }
          const messages = Array.isArray(output)
            ? output
            : output
              ? [
                  {
                    id: generateMessageId(),
                    role: getChatRole("ai"),
                    content: output,
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
          addMessage({
            playgroundInstanceId: instanceId,
            messages,
          });
          cleanupOutput();
        }}
      >
        Prompt
      </Button>
      <Tooltip>
        <TooltipArrow />
        Move the output message to the end of the prompt
      </Tooltip>
    </TooltipTrigger>
  );
};
