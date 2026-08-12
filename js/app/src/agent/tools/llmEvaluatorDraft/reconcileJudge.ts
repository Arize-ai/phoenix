import { isTemplateFormat } from "@phoenix/components/templateEditor/types";
import { parseInvocationConfig } from "@phoenix/pages/playground/providerAdapters";
import { chatMessageRolesSchema } from "@phoenix/pages/playground/schemas";
import type {
  ChatMessage,
  PlaygroundNormalizedInstance,
} from "@phoenix/store/playground";
import {
  generateMessageId,
  type PlaygroundStore,
} from "@phoenix/store/playground";
import type { ModelConfigByProvider } from "@phoenix/store/preferencesStore";
import { isModelProvider } from "@phoenix/utils/generativeUtils";

import type { EditLlmEvaluatorDraftOperation } from "./types";

type ChatMessageRole = (typeof chatMessageRolesSchema.options)[number];

// Model's "assistant" maps to the playground "ai" role; unknown roles fall back to "user".
function coerceJudgeRole(role: string): ChatMessageRole {
  const aliased = role === "assistant" ? "ai" : role;
  const parsed = chatMessageRolesSchema.safeParse(aliased);
  return parsed.success ? parsed.data : "user";
}

export function reconcileJudgeOperations({
  playgroundStore,
  instanceId,
  modelConfigByProvider,
  operations,
}: {
  playgroundStore: PlaygroundStore;
  instanceId: number;
  modelConfigByProvider: ModelConfigByProvider;
  operations: EditLlmEvaluatorDraftOperation[];
}): void {
  for (const operation of operations) {
    if (operation.type === "set_judge_prompt") {
      applyJudgePrompt({ playgroundStore, instanceId, operation });
    } else if (operation.type === "set_judge_model") {
      applyJudgeModel({
        playgroundStore,
        instanceId,
        modelConfigByProvider,
        operation,
      });
    }
  }
}

function applyJudgePrompt({
  playgroundStore,
  instanceId,
  operation,
}: {
  playgroundStore: PlaygroundStore;
  instanceId: number;
  operation: Extract<
    EditLlmEvaluatorDraftOperation,
    { type: "set_judge_prompt" }
  >;
}): void {
  if (
    operation.templateFormat != null &&
    isTemplateFormat(operation.templateFormat)
  ) {
    playgroundStore.getState().setTemplateFormat(operation.templateFormat);
  }
  playgroundStore.setState((state) => {
    const instance = state.instances.find(
      (candidate) => candidate.id === instanceId
    );
    if (!instance || instance.template.__type !== "chat") return state;
    const previousIds = instance.template.messageIds;
    const messageIds: number[] = [];
    const newMessages: Record<number, ChatMessage> = {};
    const externallyUpdatedMessageRevisionById = {
      ...state.externallyUpdatedMessageRevisionById,
    };
    for (const message of operation.messages) {
      const id = generateMessageId();
      messageIds.push(id);
      newMessages[id] = {
        id,
        role: coerceJudgeRole(message.role),
        content: message.content,
      } satisfies ChatMessage;
      externallyUpdatedMessageRevisionById[id] =
        (externallyUpdatedMessageRevisionById[id] ?? 0) + 1;
    }
    const allInstanceMessages = { ...state.allInstanceMessages };
    for (const id of previousIds) {
      delete allInstanceMessages[id];
    }
    Object.assign(allInstanceMessages, newMessages);
    return {
      ...state,
      allInstanceMessages,
      externallyUpdatedMessageRevisionById,
      dirtyInstances: {
        ...state.dirtyInstances,
        [instanceId]: true,
      },
      instances: state.instances.map(
        (candidate): PlaygroundNormalizedInstance => {
          if (
            candidate.id !== instanceId ||
            candidate.template.__type !== "chat"
          ) {
            return candidate;
          }
          return {
            ...candidate,
            template: { ...candidate.template, messageIds },
          };
        }
      ),
    };
  });
}

function applyJudgeModel({
  playgroundStore,
  instanceId,
  modelConfigByProvider,
  operation,
}: {
  playgroundStore: PlaygroundStore;
  instanceId: number;
  modelConfigByProvider: ModelConfigByProvider;
  operation: Extract<
    EditLlmEvaluatorDraftOperation,
    { type: "set_judge_model" }
  >;
}): void {
  if (!isModelProvider(operation.provider)) {
    return;
  }
  const provider = operation.provider;
  const state = playgroundStore.getState();
  const instance = state.instances.find(
    (candidate) => candidate.id === instanceId
  );
  if (!instance) return;

  // Set provider before model: switching provider resets invocation params to its defaults.
  if (provider !== instance.model.provider) {
    state.updateProvider({ instanceId, provider, modelConfigByProvider });
  }
  state.updateModel({ instanceId, patch: { modelName: operation.model } });
  if (operation.invocationParameters !== undefined) {
    state.updateInstanceModelInvocationParameters({
      instanceId,
      invocationParameters: parseInvocationConfig(
        provider,
        operation.invocationParameters
      ),
    });
  }
}
