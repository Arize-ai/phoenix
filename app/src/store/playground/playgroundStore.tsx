import { create, StateCreator } from "zustand";
import { devtools } from "zustand/middleware";

import { TemplateLanguages } from "@phoenix/components/templateEditor/constants";
import { getTemplateLanguageUtils } from "@phoenix/components/templateEditor/templateEditorUtils";
import { TemplateLanguage } from "@phoenix/components/templateEditor/types";
import {
  DEFAULT_CHAT_ROLE,
  DEFAULT_MODEL_PROVIDER,
} from "@phoenix/constants/generativeConstants";
import { assertUnreachable } from "@phoenix/typeUtils";

import {
  GenAIOperationType,
  InitialPlaygroundState,
  isManualInput,
  PlaygroundChatTemplate,
  PlaygroundInputMode,
  PlaygroundInstance,
  PlaygroundState,
  PlaygroundTextCompletionTemplate,
  Tool,
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
    model: { provider: DEFAULT_MODEL_PROVIDER, modelName: "gpt-4o" },
    tools: [],
    toolChoice: "auto",
    // TODO(apowell) - use datasetId if in dataset mode
    input: { variablesValueCache: {}, variableKeys: [] },
    output: undefined,
    activeRunId: null,
    isRunning: false,
  };
}

export function createTool(toolNumber: number): Tool {
  return {
    id: generateToolId(),
    definition: {
      type: "function",
      function: {
        name: `new_function_${toolNumber}`,
        parameters: {
          type: "object",
          properties: {
            new_arg: {
              type: "string",
            },
          },
          required: [],
        },
      },
    },
  };
}

export const createPlaygroundStore = (
  initialProps?: InitialPlaygroundState
) => {
  const playgroundStore: StateCreator<PlaygroundState> = (set, get) => ({
    operationType: "chat",
    inputMode: "manual",
    input: {
      // to get a record of visible variables and their values,
      // use usePlaygroundContext(selectDerivedInputVariables). do not render variablesValueCache
      // directly or users will see stale values.
      variablesValueCache: {
        question: "",
      },
      variableKeys: ["question"],
    },
    templateLanguage: TemplateLanguages.Mustache,
    setInputMode: (inputMode: PlaygroundInputMode) => set({ inputMode }),
    instances: [createPlaygroundInstance()],
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
      get().calculateVariables();
    },
    runPlaygroundInstances: () => {
      const instances = get().instances;
      set({
        instances: instances.map((instance) => ({
          ...instance,
          activeRunId: playgroundRunId++,
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
              activeRunId: playgroundRunId++,
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
    setTemplateLanguage: (templateLanguage: TemplateLanguage) => {
      set({ templateLanguage });
      // Re-compute variables when the template language changes
      get().calculateVariables();
    },
    calculateVariables: () => {
      const instances = get().instances;
      const variables = new Set<string>();
      const utils = getTemplateLanguageUtils(get().templateLanguage);
      instances.forEach((instance) => {
        const instanceType = instance.template.__type;
        // this double nested loop should be okay since we don't expect more than 4 instances
        // and a handful of messages per instance
        switch (instanceType) {
          case "chat": {
            // for each chat message in the instance
            instance.template.messages.forEach((message) => {
              // extract variables from the message content
              const extractedVariables = utils.extractVariables(
                message.content
              );
              extractedVariables.forEach((variable) => {
                variables.add(variable);
              });
            });
            break;
          }
          case "text_completion": {
            const extractedVariables = utils.extractVariables(
              instance.template.prompt
            );
            extractedVariables.forEach((variable) => {
              variables.add(variable);
            });
            break;
          }
          default: {
            assertUnreachable(instanceType);
          }
        }
      });
      set({
        input: { ...get().input, variableKeys: [...Array.from(variables)] },
      });
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
    ...initialProps,
  });
  return create(devtools(playgroundStore));
};

export type PlaygroundStore = ReturnType<typeof createPlaygroundStore>;

/**
 * Selects the variable keys from the playground state
 * @param state the playground state
 * @returns the variable keys
 */
export const selectInputVariableKeys = (state: PlaygroundState) => {
  if (isManualInput(state.input)) {
    return state.input.variableKeys;
  }
  return [];
};

/**
 * Selects the derived input variables from the playground state
 * @param state the playground state
 * @returns the derived input variables
 */
export const selectDerivedInputVariables = (state: PlaygroundState) => {
  if (isManualInput(state.input)) {
    const input = state.input;
    const variableKeys = input.variableKeys;
    const variablesValueCache = input.variablesValueCache;
    const valueMap: Record<string, string> = {};
    variableKeys.forEach((key) => {
      valueMap[key] = variablesValueCache?.[key] || "";
    });
    return valueMap;
  }
  return {};
};
