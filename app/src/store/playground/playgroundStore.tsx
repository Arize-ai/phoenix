import { create, StateCreator } from "zustand";
import { devtools } from "zustand/middleware";

import { TemplateLanguages } from "@phoenix/components/templateEditor/constants";
import { getTemplateLanguageUtils } from "@phoenix/components/templateEditor/templateEditorUtils";
import { TemplateLanguage } from "@phoenix/components/templateEditor/types";
import { assertUnreachable } from "@phoenix/typeUtils";

import {
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
    model: { provider: "OPENAI", modelName: "gpt-4o" },
    tools: {},
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
    input: {
      // TODO(apowell): When implementing variable forms, we should maintain a separate
      // map of variableName to variableValue. This will allow us to "cache" variable values
      // as the user types and will prevent data loss if users accidentally change the variable name
      variables: {
        // TODO(apowell): This is hardcoded based on the default chat template
        // Instead we should calculate this based on the template on store creation
        // Not a huge deal since this will be overridden on the first keystroke
        question: "",
      },
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
      get().calculateVariables();
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
    setTemplateLanguage: (templateLanguage: TemplateLanguage) => {
      set({ templateLanguage });
    },
    calculateVariables: () => {
      const instances = get().instances;
      const variables: Record<string, string> = {};
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
                variables[variable] = "";
              });
            });
            break;
          }
          case "text_completion": {
            const extractedVariables = utils.extractVariables(
              instance.template.prompt
            );
            extractedVariables.forEach((variable) => {
              variables[variable] = "";
            });
            break;
          }
          default: {
            assertUnreachable(instanceType);
          }
        }
      });
      set({ input: { variables: { ...variables } } });
    },
    ...initialProps,
  });
  return create(devtools(playgroundStore));
};

export type PlaygroundStore = ReturnType<typeof createPlaygroundStore>;
