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

import { NUM_MAX_PLAYGROUND_INSTANCES } from "./constants";
import { buildChatFromDecisionDraft } from "./decisionUtils";
import { getDefaultInvocationConfig } from "./providerAdapters";
import type { PlaygroundInstanceProps } from "./types";

/**
 * Add a task beside this decision task that asks an LLM the same questions:
 * the questions and criteria become the system message, the state the user
 * message, and the answer shape a response format. The copy uses the chat
 * model this task had before it became a decision task, else the preferred
 * default, and keeps the decision request, so picking a decision model on it
 * restores the original. The decision task stays as it is, so the two run
 * side by side.
 */
export function DuplicateAsChatButton({
  playgroundInstanceId: instanceId,
}: PlaygroundInstanceProps) {
  const store = usePlaygroundStore();
  const numInstances = usePlaygroundContext((state) => state.instances.length);
  const isRunning = usePlaygroundContext((state) =>
    state.instances.some((instance) => instance.activeRunId != null)
  );
  const defaultModelProvider = usePreferencesContext(
    (state) => state.defaultModelProvider
  );
  const defaultModelName = usePreferencesContext(
    (state) => state.defaultModelName
  );

  const duplicateAsChat = () => {
    const {
      instances,
      templateFormat,
      duplicateInstance,
      updateInstance,
      addMessage,
    } = store.getState();
    const source = instances.find((candidate) => candidate.id === instanceId);
    if (!source?.decisionRequest) return;
    const copyId = duplicateInstance(instanceId);
    if (copyId == null) return;
    const { messages, responseFormat } = buildChatFromDecisionDraft({
      draft: source.decisionRequest,
      templateFormat,
    });
    const provider = defaultModelProvider ?? DEFAULT_MODEL_PROVIDER;
    const chatModel = source.llmModel ?? {
      provider,
      modelName: defaultModelName ?? DEFAULT_MODEL_NAME,
      invocationParameters: getDefaultInvocationConfig(provider),
    };
    updateInstance({
      instanceId: copyId,
      dirty: true,
      patch: {
        task: { type: "prompt" },
        decision: null,
        decisionRequest: null,
        model: { ...chatModel, modelType: "LLM", responseFormat },
        template: { __type: "chat", messageIds: [] },
      },
    });
    addMessage({
      playgroundInstanceId: copyId,
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
        aria-label="Duplicate as an LLM prompt"
        leadingVisual={<Icon svg={<Icons.MessageSquarePlus />} />}
        isDisabled={numInstances >= NUM_MAX_PLAYGROUND_INSTANCES || isRunning}
        onPress={duplicateAsChat}
      />
      <Tooltip>
        <TooltipArrow />
        Duplicate as an LLM prompt that asks the same questions
      </Tooltip>
    </TooltipTrigger>
  );
}
