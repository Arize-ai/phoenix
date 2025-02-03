import { create, StateCreator } from "zustand";
import { devtools } from "zustand/middleware";

import { TemplateLanguages } from "@phoenix/components/templateEditor/constants";
import { TemplateLanguage } from "@phoenix/components/templateEditor/types";
import {
  DEFAULT_CHAT_ROLE,
  DEFAULT_MODEL_NAME,
  DEFAULT_MODEL_PROVIDER,
} from "@phoenix/constants/generativeConstants";
import { TOOL_CHOICE_PARAM_CANONICAL_NAME } from "@phoenix/pages/playground/constants";
import {
  areInvocationParamsEqual,
  mergeInvocationParametersWithDefaults,
} from "@phoenix/pages/playground/playgroundUtils";
import { OpenAIResponseFormat } from "@phoenix/pages/playground/schemas";

import {
  convertInstanceToolsToProvider,
  convertMessageToolCallsToProvider,
} from "./playgroundStoreUtils";
import {
  ChatMessage,
  GenAIOperationType,
  InitialPlaygroundState,
  PlaygroundChatTemplate,
  PlaygroundInstance,
  PlaygroundNormalizedChatTemplate,
  PlaygroundNormalizedInstance,
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
 * Generates a new playground run ID
 */
const generateRunId = () => playgroundRunId++;

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

export const normalizeChatTemplate = (template: PlaygroundChatTemplate) => {
  return {
    template: {
      __type: "chat",
      messageIds: template.messages.map((message) => message.id),
    } satisfies PlaygroundNormalizedChatTemplate,
    messages: template.messages.reduce(
      (acc, message) => {
        acc[message.id] = message;
        return acc;
      },
      {} as Record<number, ChatMessage>
    ),
  };
};

const DEFAULT_TEXT_COMPLETION_TEMPLATE: PlaygroundTextCompletionTemplate = {
  __type: "text_completion",
  prompt: "{{question}}",
};

export const DEFAULT_INSTANCE_PARAMS = () =>
  ({
    model: {
      provider: DEFAULT_MODEL_PROVIDER,
      modelName: DEFAULT_MODEL_NAME,
      invocationParameters: [],
      supportedInvocationParameters: [],
    },
    tools: [],
    // Default to auto tool choice as you are probably testing the LLM for it's ability to pick
    toolChoice: "auto",
    output: undefined,
    spanId: null,
    activeRunId: null,
    dirty: false,
  }) satisfies Partial<PlaygroundInstance>;

/**
 * Creates a new normalized playground instance, and an object of instance messages that can be merged
 * into a normalized store of messages
 *
 * @returns an object containing the instance and the instance messages
 */
export function createNormalizedPlaygroundInstance() {
  const template = generateChatCompletionTemplate();
  const normalizedTemplate = normalizeChatTemplate(template);
  return {
    instance: {
      id: generateInstanceId(),
      template: normalizedTemplate.template,
      ...DEFAULT_INSTANCE_PARAMS(),
    } as PlaygroundNormalizedInstance,
    instanceMessages: normalizedTemplate.messages,
  };
}

export function createOpenAIResponseFormat(): OpenAIResponseFormat {
  return {
    type: "json_schema",
    json_schema: {
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
}

/**
 * Gets the initial instances for the playground store
 * If the initial props has instances, those will be used.
 * Incoming instances are normalized on entry, and should not be normalized before passing to this function
 * If not a default instance will be created and saved model config defaults will be used if present.
 * @returns a list of {@link PlaygroundNormalizedInstance} instances
 *
 * NB: This function is only exported for testing
 */
export function getInitialInstances(initialProps: InitialPlaygroundState): {
  instances: Array<PlaygroundNormalizedInstance>;
  instanceMessages: Record<number, ChatMessage>;
} {
  if (initialProps.instances != null && initialProps.instances.length > 0) {
    let initialInstancesMessageMap: Record<number, ChatMessage> = {};
    const normalizedInstances = initialProps.instances.map((instance) => {
      if (instance.template.__type === "chat") {
        const normalizedTemplate = normalizeChatTemplate(instance.template);
        initialInstancesMessageMap = {
          ...initialInstancesMessageMap,
          ...normalizedTemplate.messages,
        };
        return {
          ...instance,
          template: normalizedTemplate.template,
        } satisfies PlaygroundNormalizedInstance;
      }
      return instance as PlaygroundNormalizedInstance;
    });
    return {
      instances: normalizedInstances,
      instanceMessages: initialInstancesMessageMap,
    };
  }
  const { instance, instanceMessages } = createNormalizedPlaygroundInstance();

  const savedModelConfigs = Object.values(initialProps.modelConfigByProvider);
  const hasSavedModelConfig = savedModelConfigs.length > 0;
  if (!hasSavedModelConfig) {
    return {
      instances: [instance],
      instanceMessages,
    };
  }
  const savedDefaultProviderConfig =
    savedModelConfigs.find(
      (config) => config.provider === DEFAULT_MODEL_PROVIDER
    ) ?? savedModelConfigs[0];
  instance.model = {
    ...instance.model,
    ...savedDefaultProviderConfig,
  };
  return {
    instances: [instance],
    instanceMessages,
  };
}

export const createPlaygroundStore = (props: InitialPlaygroundState) => {
  const { instances, instanceMessages } = getInitialInstances(props);
  const playgroundStore: StateCreator<PlaygroundState> = (set, get) => ({
    streaming: true,
    operationType: "chat",
    inputMode: "manual",
    input: {
      // variablesValueCache is used to store the values of variables for the
      // manual input mode. It is indexed by the variable key. It keeps old
      // values when variables are removed or when switching to dataset input so that they can be restored.
      variablesValueCache: {},
    },
    templateLanguage: TemplateLanguages.Mustache,
    ...props,
    instances,
    allInstanceMessages: instanceMessages,
    setInput: (input) => {
      set({ input });
    },
    setOperationType: (operationType: GenAIOperationType) => {
      if (operationType === "chat") {
        const normalizedInstances: PlaygroundNormalizedInstance[] = [];
        let messageMap: Record<number, ChatMessage> = {};
        get().instances.forEach((instance) => {
          const newMessage = generateChatCompletionTemplate();
          const normalizedTemplate = normalizeChatTemplate(newMessage);
          messageMap = {
            ...messageMap,
            ...normalizedTemplate.messages,
          };
          normalizedInstances.push({
            ...instance,
            template: normalizedTemplate.template,
          });
        });
        set({
          instances: normalizedInstances,
          allInstanceMessages: messageMap,
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
      const instanceMessages = get().allInstanceMessages;
      const firstInstance = get().instances[0];
      if (!firstInstance) {
        return;
      }
      let newMessageIds: number[] = [];
      let newMessageMap: Record<number, ChatMessage> = {};
      if (firstInstance.template.__type === "chat") {
        const messageIdsToCopy = firstInstance.template.messageIds;
        const copiedMessages = messageIdsToCopy
          .map((id) => instanceMessages[id])
          .map((message) => ({
            ...message,
            id: generateMessageId(),
          }));
        newMessageIds = copiedMessages.map((message) => message.id);
        newMessageMap = copiedMessages.reduce(
          (acc, message) => {
            acc[message.id] = message;
            return acc;
          },
          {} as Record<number, ChatMessage>
        );
      }
      set({
        allInstanceMessages: {
          ...instanceMessages,
          ...newMessageMap,
        },
        instances: [
          ...instances,
          {
            ...firstInstance,
            ...(firstInstance.template.__type === "chat"
              ? {
                  template: {
                    ...firstInstance.template,
                    messageIds: newMessageIds,
                  },
                }
              : {}),
            id: generateInstanceId(),
            activeRunId: null,
            experimentId: null,
            spanId: null,
          },
        ],
      });
    },
    updateModelSupportedInvocationParameters: ({
      instanceId,
      supportedInvocationParameters,
    }) => {
      const instances = get().instances;
      set({
        instances: instances.map((instance) => {
          if (instance.id === instanceId) {
            return {
              ...instance,
              model: {
                ...instance.model,
                supportedInvocationParameters,
                // merge the current invocation parameters with the defaults defined in supportedInvocationParameters
                invocationParameters: mergeInvocationParametersWithDefaults(
                  instance.model.invocationParameters,
                  supportedInvocationParameters
                ),
              },
              // Delete tools if the model does not support tool choice
              tools: supportedInvocationParameters.find(
                (p) => p.canonicalName === TOOL_CHOICE_PARAM_CANONICAL_NAME
              )
                ? instance.tools
                : [],
            };
          }
          return instance;
        }),
      });
    },
    updateProvider: ({ instanceId, provider, modelConfigByProvider }) => {
      const instances = get().instances;
      const instance = instances.find((instance) => instance.id === instanceId);
      if (!instance) {
        return;
      }
      if (instance.model.provider === provider) {
        return;
      }

      const savedProviderConfig = modelConfigByProvider[provider];

      const patch: Partial<PlaygroundNormalizedInstance> = {
        // If we have a saved config for the provider, use it as the default otherwise reset the model config entirely to defaults / unset which will be controlled by invocation params coming from the server
        model: savedProviderConfig
          ? {
              ...savedProviderConfig,
              // Reset invocation parameters to unset, these will be subsequently fetched and updated from the server
              // These are not be saved in the model config as they are controlled exclusively by the server
              supportedInvocationParameters: [],
              provider,
            }
          : {
              modelName: null,
              // Reset invocation parameters to unset, these will be subsequently fetched and updated from the server
              invocationParameters: [],
              // Reset supported invocation parameters to unset, these will be subsequently fetched and updated from the server
              supportedInvocationParameters: [],
              apiVersion: null,
              endpoint: null,
              provider,
            },
        tools: convertInstanceToolsToProvider({
          instanceTools: instance.tools,
          provider,
        }),
      };
      const messageMapPatch: Record<number, ChatMessage> = {};
      if (instance.template.__type === "chat") {
        instance.template.messageIds.forEach((messageId) => {
          const message = get().allInstanceMessages[messageId];
          if (message) {
            messageMapPatch[messageId] = {
              ...message,
              toolCalls: convertMessageToolCallsToProvider({
                toolCalls: message.toolCalls,
                provider,
              }),
            };
          }
        });
      }
      set({
        allInstanceMessages: {
          ...get().allInstanceMessages,
          ...messageMapPatch,
        },
        instances: instances.map((instance) => {
          if (instance.id === instanceId) {
            return {
              ...instance,
              ...patch,
              dirty: true,
            };
          }
          return instance;
        }),
      });
    },
    updateModel: ({ instanceId, patch }) => {
      const instances = get().instances;
      const instance = instances.find((instance) => instance.id === instanceId);
      if (!instance) {
        return;
      }
      set({
        instances: instances.map((instance) => {
          if (instance.id === instanceId) {
            return {
              ...instance,
              dirty: true,
              model: {
                ...instance.model,
                ...patch,
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
    addMessage: ({ playgroundInstanceId, messages }) => {
      const instances = get().instances;
      let newMessages: ChatMessage[] = [];
      if (Array.isArray(messages)) {
        newMessages = messages;
      } else if (messages) {
        newMessages = [messages];
      } else {
        newMessages = [
          {
            id: generateMessageId(),
            role: DEFAULT_CHAT_ROLE,
            content: "",
          },
        ];
      }

      // Update the given instance
      set({
        allInstanceMessages: {
          ...get().allInstanceMessages,
          ...newMessages.reduce(
            (acc, message) => {
              acc[message.id] = message;
              return acc;
            },
            {} as Record<number, ChatMessage>
          ),
        },
        instances: instances.map((instance) => {
          if (
            instance.id === playgroundInstanceId &&
            instance?.template &&
            instance?.template.__type === "chat"
          ) {
            return {
              ...instance,
              dirty: true,
              template: {
                ...instance.template,
                messageIds: [
                  ...instance.template.messageIds,
                  ...newMessages.map((message) => message.id),
                ],
              },
            };
          }
          return instance;
        }),
      });
    },
    updateMessage: ({ messageId, patch, instanceId }) => {
      const allInstanceMessages = get().allInstanceMessages;
      set({
        allInstanceMessages: {
          ...allInstanceMessages,
          [messageId]: {
            ...allInstanceMessages[messageId],
            ...patch,
          },
        },
      });
      get().updateInstance({
        instanceId,
        patch: {},
        dirty: true,
      });
    },
    deleteMessage: ({ instanceId, messageId }) => {
      const instances = get().instances;
      const allInstanceMessages = get().allInstanceMessages;
      set({
        allInstanceMessages: Object.fromEntries(
          Object.entries(allInstanceMessages).filter(
            ([, { id }]) => id !== messageId
          )
        ),
        instances: instances.map((instance) => {
          if (
            instance.id === instanceId &&
            instance?.template &&
            instance?.template.__type === "chat"
          ) {
            return {
              ...instance,
              dirty: true,
              template: {
                ...instance.template,
                messageIds: instance.template.messageIds.filter(
                  (id) => id !== messageId
                ),
              },
            };
          }
          return instance;
        }),
      });
    },
    updateInstance: ({ instanceId, patch, dirty }) => {
      const instances = get().instances;
      set({
        instances: instances.map((instance) => {
          if (instance.id === instanceId) {
            return {
              ...instance,
              ...patch,
              ...(dirty != undefined ? { dirty } : {}),
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
          activeRunId: generateRunId(),
          spanId: null, // Clear out the span when (re)running
        })),
      });
    },
    cancelPlaygroundInstances: () => {
      const instances = get().instances;
      set({
        instances: instances.map((instance) => ({
          ...instance,
          activeRunId: null,
          spanId: null,
        })),
      });
    },
    markPlaygroundInstanceComplete: (instanceId: number) => {
      const instances = get().instances;
      set({
        instances: instances.map((instance) => {
          if (instance.id === instanceId) {
            return {
              ...instance,
              activeRunId: null,
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
      set({
        input: {
          ...input,
          variablesValueCache: { ...input.variablesValueCache, [key]: value },
        },
      });
    },
    setStreaming: (streaming: boolean) => {
      set({ streaming });
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
              dirty: true,
              model: { ...instance.model, invocationParameters },
            };
          }
          return instance;
        }),
      });
    },
    upsertInvocationParameterInput: ({
      instanceId,
      invocationParameterInput,
    }) => {
      const instance = get().instances.find((i) => i.id === instanceId);
      if (!instance) {
        return;
      }
      const currentInvocationParameterInput =
        instance.model.invocationParameters.find((p) =>
          areInvocationParamsEqual(p, invocationParameterInput)
        );

      if (currentInvocationParameterInput) {
        set({
          instances: get().instances.map((instance) => {
            if (instance.id === instanceId) {
              return {
                ...instance,
                dirty: true,
                model: {
                  ...instance.model,
                  invocationParameters: instance.model.invocationParameters.map(
                    (p) =>
                      areInvocationParamsEqual(p, invocationParameterInput)
                        ? invocationParameterInput
                        : p
                  ),
                },
              };
            }
            return instance;
          }),
        });
      } else {
        set({
          instances: get().instances.map((instance) => {
            if (instance.id === instanceId) {
              return {
                ...instance,
                dirty: true,
                model: {
                  ...instance.model,
                  invocationParameters: [
                    ...instance.model.invocationParameters,
                    invocationParameterInput,
                  ],
                },
              };
            }
            return instance;
          }),
        });
      }
    },
    deleteInvocationParameterInput: ({
      instanceId,
      invocationParameterInputInvocationName,
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
              dirty: true,
              model: {
                ...instance.model,
                invocationParameters:
                  instance.model.invocationParameters.filter(
                    (p) =>
                      p.invocationName !==
                      invocationParameterInputInvocationName
                  ),
              },
            };
          }
          return instance;
        }),
      });
    },
    setDirty: (instanceId: number, dirty: boolean) => {
      const instances = get().instances;
      set({
        instances: instances.map((instance) => {
          if (instance.id === instanceId) {
            return {
              ...instance,
              dirty,
            };
          }
          return instance;
        }),
      });
    },
  });
  return create(devtools(playgroundStore));
};

export type PlaygroundStore = ReturnType<typeof createPlaygroundStore>;
