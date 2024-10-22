import { create, StateCreator } from "zustand";
import { devtools } from "zustand/middleware";

import { TemplateLanguages } from "@phoenix/components/templateEditor/constants";
import { TemplateLanguage } from "@phoenix/components/templateEditor/types";
import {
  DEFAULT_CHAT_ROLE,
  DEFAULT_MODEL_PROVIDER,
} from "@phoenix/constants/generativeConstants";
import { OpenAIToolCall } from "@phoenix/schemas";

import {
  GenAIOperationType,
  InitialPlaygroundState,
  isManualInput,
  OpenAITool,
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
      modelName: "gpt-4o",
      invocationParameters: {},
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
 * Creates an empty OpenAI tool call with fields but no values filled in
 */
export function createOpenAIToolCall(): OpenAIToolCall {
  return {
    id: "",
    function: {
      name: "",
      arguments: {},
    },
  };
}

/**
 * Creates a default tool with a unique ID and a function definition
 * @param toolNumber the number of the tool in that instance for example instance.tools.length + 1
 * @returns a {@link Tool} with a unique ID and a function definition
 */
export function createOpenAITool(toolNumber: number): OpenAITool {
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
            isRunning: false,
            spanId: null,
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
                invocationParameters: {
                  ...instance.model.invocationParameters,
                  ...model.invocationParameters,
                },
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
    ...initialProps,
  });
  return create(devtools(playgroundStore));
};

export type PlaygroundStore = ReturnType<typeof createPlaygroundStore>;
