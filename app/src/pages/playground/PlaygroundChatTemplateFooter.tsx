import { Button, Flex, Icon, Icons } from "@phoenix/components";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";
import { safelyConvertToolChoiceToProvider } from "@phoenix/schemas/toolChoiceSchemas";
import {
  createOpenAIResponseFormat,
  generateMessageId,
  PlaygroundNormalizedInstance,
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
  const addMessage = usePlaygroundContext((state) => state.addMessage);
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
          aria-label="response format"
          leadingVisual={<Icon svg={<Icons.PlusOutline />} />}
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
          Response Format
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
                createToolForProvider({
                  provider: playgroundInstance.model.provider,
                  toolNumber: playgroundInstance.tools.length + 1,
                }),
              ],
            };
            if (playgroundInstance.tools.length === 0) {
              const convertedChoice = safelyConvertToolChoiceToProvider({
                toolChoice: "auto",
                targetProvider: playgroundInstance.model.provider,
              });
              // set a new default tool choice that is appropriate for the provider
              if (convertedChoice) {
                patch.toolChoice = convertedChoice;
              }
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
