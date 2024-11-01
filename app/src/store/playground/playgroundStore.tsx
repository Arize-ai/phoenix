import { create, StateCreator } from "zustand";
import { devtools } from "zustand/middleware";

import { TemplateLanguages } from "@phoenix/components/templateEditor/constants";
import { TemplateLanguage } from "@phoenix/components/templateEditor/types";
import {
  DEFAULT_CHAT_ROLE,
  DEFAULT_MODEL_NAME,
  DEFAULT_MODEL_PROVIDER,
} from "@phoenix/constants/generativeConstants";

import {
  GenAIOperationType,
  InitialPlaygroundState,
  isManualInput,
  PlaygroundChatTemplate,
  PlaygroundInputMode,
  PlaygroundInstance,
  PlaygroundState,
  PlaygroundTextCompletionTemplate,
} from "./types";

let playgroundInstanceId = 0;
let playgroundRunId = 0;
// This value must be truthy in order for message re-ordering to work
let playgroundMessageId = 1;
let playgroundToolId = 0;

/**
 * Generates a new playground instance ID
 */
export const generateInstanceId = () => playgroundInstanceId++;

/**
 * Generates a new playground message ID
 */
export const generateMessageId = () => playgroundMessageId++;

/**
 * Generates a new playground tool ID
 */
export const generateToolId = () => playgroundToolId++;

/**
 * Resets the playground instance ID to 0
 *
 * NB: This is only used for testing purposes
 */
export const _resetInstanceId = () => {
  playgroundInstanceId = 0;
};

/**
 * Resets the playground message ID to 0
 *
 * NB: This is only used for testing purposes
 */
export const _resetMessageId = () => {
  playgroundMessageId = 0;
};

/**
 * Resets the playground tool ID to 0
 *
 * NB: This is only used for testing purposes
 */
export const _resetToolId = () => {
  playgroundToolId = 0;
};

const generateChatCompletionTemplate = (): PlaygroundChatTemplate => ({
  __type: "chat",
  messages: [
    {
      id: generateMessageId(),
      role: "system",
      content: "You are a chatbot",
    },
    {
      id: generateMessageId(),
      role: "user",
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
    model: {
      provider: DEFAULT_MODEL_PROVIDER,
      modelName: DEFAULT_MODEL_NAME,
      invocationParameters: [],
    },
    tools: [],
    // Default to auto tool choice as you are probably testing the LLM for it's ability to pick
    toolChoice: "auto",
    // TODO(apowell) - use datasetId if in dataset mode
    input: { variablesValueCache: {} },
    output: undefined,
    spanId: null,
    activeRunId: null,
    isRunning: false,
  };
}

/**
 * Gets the initial instances for the playground store
 * If the initial props has instances, those will be used.
 * If not a default instance will be created and saved model config defaults will be used if present.
 * @returns a list of {@link PlaygroundInstance} instances
 *
 * NB: This function is only exported for testing
 */
export function getInitialInstances(initialProps: InitialPlaygroundState) {
  if (initialProps.instances != null && initialProps.instances.length > 0) {
    return initialProps.instances;
  }
  const instance = createPlaygroundInstance();

  const savedModelConfigs = Object.values(initialProps.modelConfigByProvider);
  const hasSavedModelConfig = savedModelConfigs.length > 0;
  if (!hasSavedModelConfig) {
    return [instance];
  }
  const savedDefaultProviderConfig =
    savedModelConfigs.find(
      (config) => config.provider === DEFAULT_MODEL_PROVIDER
    ) ?? savedModelConfigs[0];
  instance.model = {
    ...instance.model,
    ...savedDefaultProviderConfig,
  };
  return [instance];
}

export const createPlaygroundStore = (initialProps: InitialPlaygroundState) => {
  const playgroundStore: StateCreator<PlaygroundState> = (set, get) => ({
    streaming: true,
    operationType: "chat",
    inputMode: "manual",
    input: {
      // variablesValueCache is used to store the values of variables for the
      // manual input mode. It is indexed by the variable key. It keeps old
      // values when variables are removed so that they can be restored.
      variablesValueCache: {},
    },
    templateLanguage: TemplateLanguages.Mustache,
    setInputMode: (inputMode: PlaygroundInputMode) => set({ inputMode }),
    instances: getInitialInstances(initialProps),
    setOperationType: (operationType: GenAIOperationType) => {
      if (operationType === "chat") {
        set({
          instances: get().instances.map((instance) => ({
            ...instance,
            template: generateChatCompletionTemplate(),
          })),
        });
      } else {
        set({
          instances: get().instances.map((instance) => ({
            ...instance,
            template: DEFAULT_TEXT_COMPLETION_TEMPLATE,
          })),
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
            isRunning: false,
            spanId: null,
          },
        ],
      });
    },
    updateModel: ({ instanceId, model, modelConfigByProvider }) => {
      const instances = get().instances;
      const instance = instances.find((instance) => instance.id === instanceId);
      if (!instance) {
        return;
      }
      let newModel = model;
      const currentModel = instance.model;
      const savedProviderConfig =
        model.provider != null
          ? modelConfigByProvider[model.provider]
          : undefined;

      if (model.provider !== currentModel.provider) {
        if (savedProviderConfig != null) {
          newModel = {
            ...savedProviderConfig,
            provider: model.provider,
            invocationParameters: [
              ...instance.model.invocationParameters,
              // These should never be changing at the same time as the provider but spread here to be safe
              ...(model.invocationParameters ?? []),
            ],
          };
        } else {
          // Force clear the model name if the provider changes
          newModel = {
            ...newModel,
            modelName: undefined,
          };
        }
      }

      set({
        instances: instances.map((instance) => {
          if (instance.id === instanceId) {
            return {
              ...instance,
              model: {
                ...instance.model,
                ...newModel,
                invocationParameters: [
                  ...(instance.model.invocationParameters ?? []),
                  ...(model.invocationParameters ?? []),
                ],
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
                { role: DEFAULT_CHAT_ROLE, content: "{question}" },
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
          activeRunId: playgroundRunId++,
          isRunning: true,
          spanId: null, // Clear out the span when (re)running
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
              activeRunId: playgroundRunId++,
              isRunning: true,
              spanId: null, // Clear out the span when (re)running
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
    setTemplateLanguage: (templateLanguage: TemplateLanguage) => {
      set({ templateLanguage });
    },
    setVariableValue: (key: string, value: string) => {
      const input = get().input;
      if (isManualInput(input)) {
        set({
          input: {
            ...input,
            variablesValueCache: { ...input.variablesValueCache, [key]: value },
          },
        });
      }
    },
    setStreaming: (streaming: boolean) => {
      set({ streaming });
    },
    filterInstanceModelInvocationParameters: ({
      instanceId,
      modelSupportedInvocationParameters,
      filter,
    }) => {
      set({
        instances: get().instances.map((instance) => {
          if (instance.id === instanceId) {
            return {
              ...instance,
              model: {
                ...instance.model,
                invocationParameters: filter(
                  instance.model.invocationParameters,
                  modelSupportedInvocationParameters
                ),
              },
            };
          }
          return instance;
        }),
      });
    },
    updateInstanceModelInvocationParameters: ({
      instanceId,
      invocationParameters,
    }) => {
      const instance = get().instances.find((i) => i.id === instanceId);
      if (!instance) {
        return;
      }
      set({
        instances: get().instances.map((instance) => {
          if (instance.id === instanceId) {
            return {
              ...instance,
              model: { ...instance.model, invocationParameters },
            };
          }
          return instance;
        }),
      });
    },
    ...initialProps,
  });
  return create(devtools(playgroundStore));
};

export type PlaygroundStore = ReturnType<typeof createPlaygroundStore>;
