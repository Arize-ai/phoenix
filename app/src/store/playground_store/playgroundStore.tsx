import { create, StateCreator } from "zustand";
import { devtools, persist } from "zustand/middleware";

import {
  ChatMessageRole,
  GenAIOperationType,
  InitialPlaygroundState,
  PlaygroundChatTemplate,
  PlaygroundInputMode,
  PlaygroundInstance,
  PlaygroundState,
  PlaygroundTextCompletionTemplate,
} from "./types";

let playgroundInstanceIdIndex = 0;
let playgroundRunIdIndex = 0;
// This value must be truthy in order for message re-ordering to work
let playgroundMessageIdIndex = 1;

/**
 * Generates a new playground instance ID
 */
export const generateInstanceId = () => playgroundInstanceIdIndex++;

/**
 * Generates a new playground message ID
 */
export const generateMessageId = () => playgroundMessageIdIndex++;

/**
 * Resets the playground instance ID to 0
 *
 * NB: This is only used for testing purposes
 */
export const _resetInstanceId = () => {
  playgroundInstanceIdIndex = 0;
};

/**
 * Resets the playground message ID to 0
 *
 * NB: This is only used for testing purposes
 */
export const _resetMessageId = () => {
  playgroundMessageIdIndex = 0;
};

const generateChatCompletionTemplate = (): PlaygroundChatTemplate => ({
  __type: "chat",
  messages: [
    {
      id: generateMessageId(),
      role: ChatMessageRole.system,
      content: "You are a chatbot",
    },
    {
      id: generateMessageId(),
      role: ChatMessageRole.user,
      content: "{{question}}",
    },
  ],
});

const DEFAULT_TEXT_COMPLETION_TEMPLATE: PlaygroundTextCompletionTemplate = {
  __type: "text_completion",
  prompt: "{{question}}",
};

export function createPlaygroundInstance(): PlaygroundInstance {
  return {
    id: generateInstanceId(),
    template: generateChatCompletionTemplate(),
    model: { provider: "OPENAI", modelName: "gpt-4o" },
    tools: {},
    input: { variables: {} },
    output: undefined,
    activeRunId: null,
    isRunning: false,
  };
}

export const createPlaygroundStore = (
  initialProps?: InitialPlaygroundState
) => {
  const playgroundStore: StateCreator<PlaygroundState> = (set, get) => ({
    operationType: "chat",
    inputMode: "manual",
    setInputMode: (inputMode: PlaygroundInputMode) => set({ inputMode }),
    instances: [createPlaygroundInstance()],
    setOperationType: (operationType: GenAIOperationType) => {
      if (operationType === "chat") {
        // TODO: this is incorrect, it should only change the template
        set({
          instances: [
            {
              id: generateInstanceId(),
              model: { provider: "OPENAI", modelName: "gpt-4o" },
              template: generateChatCompletionTemplate(),
              tools: {},
              input: { variables: {} },
              output: undefined,
              activeRunId: null,
              isRunning: false,
            },
          ],
        });
      } else {
        set({
          instances: [
            {
              id: generateInstanceId(),
              model: { provider: "OPENAI", modelName: "gpt-4o" },
              template: DEFAULT_TEXT_COMPLETION_TEMPLATE,
              tools: {},
              input: { variables: {} },
              output: undefined,
              activeRunId: null,
              isRunning: false,
            },
          ],
        });
      }
      set({ operationType });
    },
    addInstance: () => {
      const instances = get().instances;
      const firstInstance = get().instances[0];
      if (!firstInstance) {
        return;
      }
      set({
        instances: [
          ...instances,
          {
            ...firstInstance,
            id: generateInstanceId(),
            activeRunId: null,
          },
        ],
      });
    },
    updateModel: ({ instanceId, model }) => {
      const instances = get().instances;
      const instance = instances.find((instance) => instance.id === instanceId);
      if (!instance) {
        return;
      }
      const currentModel = instance.model;
      if (model.provider !== currentModel.provider) {
        // Force clear the model name if the provider changes
        model = {
          ...model,
          modelName: undefined,
        };
      }
      set({
        instances: instances.map((instance) => {
          if (instance.id === instanceId) {
            return {
              ...instance,
              model: {
                ...instance.model,
                ...model,
              },
            };
          }
          return instance;
        }),
      });
    },
    deleteInstance: (instanceId: number) => {
      const instances = get().instances;
      set({
        instances: instances.filter((instance) => instance.id !== instanceId),
      });
    },
    addMessage: ({ playgroundInstanceId }) => {
      const instances = get().instances;

      // Update the given instance
      set({
        instances: instances.map((instance) => {
          if (
            instance.id === playgroundInstanceId &&
            instance?.template &&
            instance?.template.__type === "chat"
          ) {
            return {
              ...instance,
              messages: [
                ...instance.template.messages,
                { role: "user", content: "{question}" },
              ],
            };
          }
          return instance;
        }),
      });
    },
    updateInstance: ({ instanceId, patch }) => {
      const instances = get().instances;
      set({
        instances: instances.map((instance) => {
          if (instance.id === instanceId) {
            return {
              ...instance,
              ...patch,
            };
          }
          return instance;
        }),
      });
    },
    runPlaygroundInstances: () => {
      const instances = get().instances;
      set({
        instances: instances.map((instance) => ({
          ...instance,
          activeRunId: playgroundRunIdIndex++,
          isRunning: true,
        })),
      });
    },
    runPlaygroundInstance: (instanceId: number) => {
      const instances = get().instances;
      set({
        instances: instances.map((instance) => {
          if (instance.id === instanceId) {
            return {
              ...instance,
              activeRunId: playgroundRunIdIndex++,
              isRunning: true,
            };
          }
          return instance;
        }),
      });
    },
    markPlaygroundInstanceComplete: (instanceId: number) => {
      const instances = get().instances;
      set({
        instances: instances.map((instance) => {
          if (instance.id === instanceId) {
            return {
              ...instance,
              isRunning: false,
            };
          }
          return instance;
        }),
      });
    },
    credentials: {},
    ...initialProps,
  });
  return create(
    devtools(
      persist(playgroundStore, {
        name: "arize-phoenix-playground",
        partialize: (state) => ({
          ...state.credentials,
        }),
      })
    )
  );
};

export type PlaygroundStore = ReturnType<typeof createPlaygroundStore>;
