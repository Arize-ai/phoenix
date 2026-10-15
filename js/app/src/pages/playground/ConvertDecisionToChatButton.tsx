import {
  Button,
  Icon,
  Icons,
  Tooltip,
  TooltipArrow,
  TooltipTrigger,
} from "@phoenix/components";
import {
  DEFAULT_MODEL_NAME,
  DEFAULT_MODEL_PROVIDER,
} from "@phoenix/constants/generativeConstants";
import {
  usePlaygroundContext,
  usePlaygroundStore,
} from "@phoenix/contexts/PlaygroundContext";
import { usePreferencesContext } from "@phoenix/contexts/PreferencesContext";
import { generateMessageId } from "@phoenix/store";

import { buildChatFromDecisionDraft } from "./decisionUtils";
import { getDefaultInvocationConfig } from "./providerAdapters";
import type { PlaygroundInstanceProps } from "./types";

/**
 * Turn a decision instance into a chat instance that asks an LLM the same
 * questions: the questions and criteria become the system message, the
 * state the user message, and the answer shape a response format. The chat
 * model is the one the instance had before it became a decision instance,
 * else the preferred default. The decision request stays on the instance,
 * so picking a decision model again restores it.
 */
export function ConvertDecisionToChatButton({
  playgroundInstanceId: instanceId,
}: PlaygroundInstanceProps) {
  const store = usePlaygroundStore();
  const isRunning = usePlaygroundContext(
    (state) =>
      state.instances.find((instance) => instance.id === instanceId)
        ?.activeRunId != null
  );
  const defaultModelProvider = usePreferencesContext(
    (state) => state.defaultModelProvider
  );
  const defaultModelName = usePreferencesContext(
    (state) => state.defaultModelName
  );

  const convert = () => {
    const { instances, updateInstance, addMessage } = store.getState();
    const instance = instances.find((candidate) => candidate.id === instanceId);
    if (!instance?.decisionRequest) return;
    const { messages, responseFormat } = buildChatFromDecisionDraft({
      draft: instance.decisionRequest,
    });
    const provider = defaultModelProvider ?? DEFAULT_MODEL_PROVIDER;
    const chatModel = instance.llmModel ?? {
      provider,
      modelName: defaultModelName ?? DEFAULT_MODEL_NAME,
      invocationParameters: getDefaultInvocationConfig(provider),
    };
    updateInstance({
      instanceId,
      dirty: true,
      patch: {
        model: { ...chatModel, modelType: "LLM", responseFormat },
        template: { __type: "chat", messageIds: [] },
        repetitions: {},
        experiment: null,
      },
    });
    addMessage({
      playgroundInstanceId: instanceId,
      messages: messages.map((message) => ({
        ...message,
        id: generateMessageId(),
      })),
    });
  };

  return (
    <TooltipTrigger>
      <Button
        size="S"
        leadingVisual={<Icon svg={<Icons.ArrowCompare />} />}
        isDisabled={isRunning}
        onPress={convert}
      >
        Convert to LLM
      </Button>
      <Tooltip>
        <TooltipArrow />
        Ask an LLM the same questions: the questions become the system prompt,
        the state the user message, and the answers a response format.
      </Tooltip>
    </TooltipTrigger>
  );
}
