import { Button, Flex, Icon, Icons } from "@phoenix/components";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";
import type {
  CanonicalResponseFormat,
  PlaygroundNormalizedInstance,
} from "@phoenix/store";
import { generateMessageId } from "@phoenix/store";

import { createTool } from "./playgroundUtils";

const DEFAULT_RESPONSE_FORMAT: CanonicalResponseFormat = {
  type: "json_schema",
  jsonSchema: {
    name: "response",
    schema: {
      type: "object",
      properties: {},
      required: [],
      additionalProperties: false,
    },
    strict: true,
  },
};

type PlaygroundChatTemplateFooterProps = {
  instanceId: number;
  hasResponseFormat: boolean;
  supportsResponseFormat: boolean;
  disableNewTool?: boolean;
};

const FOOTER_MIN_HEIGHT = 32;

export function PlaygroundChatTemplateFooter({
  instanceId,
  hasResponseFormat,
  supportsResponseFormat,
  disableNewTool,
}: PlaygroundChatTemplateFooterProps) {
  const instances = usePlaygroundContext((state) => state.instances);
  const updateInstance = usePlaygroundContext((state) => state.updateInstance);
  const addMessage = usePlaygroundContext((state) => state.addMessage);
  const setResponseFormat = usePlaygroundContext(
    (state) => state.setResponseFormat
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

  const supportsToolChoice = !disableNewTool;
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
          aria-label="response format"
          leadingVisual={<Icon svg={<Icons.PlusOutline />} />}
          isDisabled={hasResponseFormat}
          onPress={() => {
            setResponseFormat({
              instanceId,
              responseFormat: DEFAULT_RESPONSE_FORMAT,
            });
          }}
        >
          {playgroundInstance.model.provider === "GOOGLE" ||
          playgroundInstance.model.provider === "AWS"
            ? "Response Schema"
            : "Response Format"}
        </Button>
      ) : null}
      {supportsToolChoice ? (
        <Button
          aria-label="add tool"
          size="S"
          leadingVisual={<Icon svg={<Icons.PlusOutline />} />}
          onPress={() => {
            const patch: Partial<PlaygroundNormalizedInstance> = {
              tools: [
                ...playgroundInstance.tools,
                createTool({
                  toolNumber: playgroundInstance.tools.length + 1,
                }),
              ],
            };
            if (playgroundInstance.tools.length === 0) {
              patch.toolChoice = { type: "ZERO_OR_MORE" };
            }
            updateInstance({
              instanceId,
              patch,
              dirty: true,
            });
          }}
        >
          Tool
        </Button>
      ) : null}
      <Button
        aria-label="add message"
        size="S"
        leadingVisual={<Icon svg={<Icons.PlusOutline />} />}
        onPress={() => {
          addMessage({
            playgroundInstanceId: instanceId,
            messages: [
              {
                id: generateMessageId(),
                role: "user",
                content: "",
              },
            ],
          });
        }}
      >
        Message
      </Button>
    </Flex>
  );
}
