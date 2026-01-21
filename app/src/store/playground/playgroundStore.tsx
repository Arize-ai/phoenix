import { create, StateCreator } from "zustand";
import { devtools } from "zustand/middleware";

import { TemplateFormats } from "@phoenix/components/templateEditor/constants";
import { TemplateFormat } from "@phoenix/components/templateEditor/types";
import {
  DEFAULT_CHAT_ROLE,
  DEFAULT_MODEL_NAME,
  DEFAULT_MODEL_PROVIDER,
} from "@phoenix/constants/generativeConstants";
import {
  RESPONSE_FORMAT_PARAM_CANONICAL_NAME,
  RESPONSE_FORMAT_PARAM_NAME,
  TOOL_CHOICE_PARAM_CANONICAL_NAME,
} from "@phoenix/pages/playground/constants";
import {
  areInvocationParamsEqual,
  constrainInvocationParameterInputsToDefinition,
  mergeInvocationParametersWithDefaults,
} from "@phoenix/pages/playground/invocationParameterUtils";
import type { PartialOutputToolCall } from "@phoenix/pages/playground/PlaygroundToolCall";
import { OpenAIResponseFormat } from "@phoenix/pages/playground/schemas";
import { safelyConvertToolChoiceToProvider } from "@phoenix/schemas/toolChoiceSchemas";

import {
  convertInstanceToolsToProvider,
  convertMessageToolCallsToProvider,
} from "./playgroundStoreUtils";
import type {
  ChatMessage,
  GenAIOperationType,
  InitialPlaygroundState,
  PlaygroundChatTemplate,
  PlaygroundError,
  PlaygroundInstance,
  PlaygroundNormalizedChatTemplate,
  PlaygroundNormalizedInstance,
  PlaygroundRepetitionStatus,
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

export const generateChatCompletionTemplate = (): PlaygroundChatTemplate => ({
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
    repetitions: {
      1: {
        output: null,
        spanId: null,
        error: null,
        status: "notStarted",
        toolCalls: {},
      },
    },
    activeRunId: null,
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
      selectedRepetitionNumber: 1,
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
  const playgroundStore: StateCreator<
    PlaygroundState,
    [["zustand/devtools", never]]
  > = (set, get) => ({
    streaming: true,
    repetitions: 1,
    operationType: "chat",
    inputMode: "manual",
    dirtyInstances: {},
    input: {
      // variablesValueCache is used to store the values of variables for the
      // manual input mode. It is indexed by the variable key. It keeps old
      // values when variables are removed or when switching to dataset input so that they can be restored.
      variablesValueCache: {},
    },
    templateFormat: TemplateFormats.Mustache,
    appendedMessagesPath: null,
    templateVariablesPath: "input",
    ...props,
    instances,
    allInstanceMessages: instanceMessages,
    setInput: (input) => {
      set({ input }, false, { type: "setInput" });
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
        set(
          {
            instances: normalizedInstances,
            allInstanceMessages: messageMap,
          },
          false,
          { type: "setOperationType/chat" }
        );
      } else {
        set(
          {
            instances: get().instances.map((instance) => ({
              ...instance,
              template: DEFAULT_TEXT_COMPLETION_TEMPLATE,
            })),
          },
          false,
          { type: "setOperationType/text_completion" }
        );
      }
      set({ operationType }, false, { type: "setOperationType" });
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
      set(
        {
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
              repetitions: {},
            },
          ],
        },
        false,
        { type: "addInstance" }
      );
    },
    updateModelSupportedInvocationParameters: ({
      instanceId,
      supportedInvocationParameters,
      modelConfigByProvider,
    }) => {
      const instances = get().instances;
      set(
        {
          instances: instances.map((instance) => {
            if (instance.id === instanceId) {
              // if we have top level model config for the provider, merge it in
              // this allows us to populate default values for baseUrl, endpoint, and region
              // when the user has saved an azure prompt and we load it back in
              const { baseUrl, endpoint, region } =
                modelConfigByProvider[instance.model.provider] ?? {};

              // Preserve the response format invocation parameter regardless of dirty state
              // This ensures response format is not lost when the model changes
              const responseFormatInvocationParameter =
                instance.model.invocationParameters.find(
                  (p) =>
                    p.canonicalName === RESPONSE_FORMAT_PARAM_CANONICAL_NAME ||
                    p.invocationName === RESPONSE_FORMAT_PARAM_NAME
                );

              // try to port dirty invocation parameters to the new supported invocation parameters
              // ensure that the invocation parameters are only the ones that are supported by the model
              const dirtyInvocationParameters =
                instance.model.invocationParameters.filter((p) => p.dirty);
              const filteredInvocationParameters =
                constrainInvocationParameterInputsToDefinition(
                  dirtyInvocationParameters,
                  supportedInvocationParameters
                );
              // merge the current invocation parameters with the defaults defined in supportedInvocationParameters
              const mergedInvocationParameters =
                mergeInvocationParametersWithDefaults(
                  filteredInvocationParameters,
                  supportedInvocationParameters
                );

              // Add back the response format if it exists and is supported by the model
              // but only if it's not already present in mergedInvocationParameters
              // (it would be present if the parameter had dirty: true)
              const modelSupportsResponseFormat =
                supportedInvocationParameters.some(
                  (p) =>
                    p.canonicalName === RESPONSE_FORMAT_PARAM_CANONICAL_NAME ||
                    p.invocationName === RESPONSE_FORMAT_PARAM_NAME
                );
              const responseFormatAlreadyInMerged =
                mergedInvocationParameters.some(
                  (p) =>
                    p.canonicalName === RESPONSE_FORMAT_PARAM_CANONICAL_NAME ||
                    p.invocationName === RESPONSE_FORMAT_PARAM_NAME
                );
              const finalInvocationParameters =
                responseFormatInvocationParameter &&
                modelSupportsResponseFormat &&
                !responseFormatAlreadyInMerged
                  ? [
                      ...mergedInvocationParameters,
                      responseFormatInvocationParameter,
                    ]
                  : mergedInvocationParameters;

              return {
                ...instance,
                model: {
                  ...instance.model,
                  baseUrl: instance.model.baseUrl ?? baseUrl,
                  endpoint: instance.model.endpoint ?? endpoint,
                  region: instance.model.region ?? region,
                  supportedInvocationParameters,
                  invocationParameters: finalInvocationParameters,
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
        },
        false,
        { type: "updateModelSupportedInvocationParameters" }
      );
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

      // pluck the response format invocation parameter from the current invocation parameters
      // so we can merge it with the saved provider config if necessary
      const responseFormatInvocationParameter =
        instance.model.invocationParameters.find(
          (p) =>
            p.canonicalName === RESPONSE_FORMAT_PARAM_CANONICAL_NAME ||
            p.invocationName === RESPONSE_FORMAT_PARAM_NAME
        );

      // Set default baseUrl for OLLAMA if no saved config exists
      const getDefaultBaseUrl = (provider: ModelProvider) => {
        if (provider === "OLLAMA") {
          return "http://localhost:11434/v1";
        }
        return null;
      };

      const patch: Partial<PlaygroundNormalizedInstance> = {
        // If we have a saved config for the provider, use it as the default otherwise reset the
        // model config entirely to defaults / unset which will be controlled by invocation params coming from the server
        model: (() => {
          // Start with base instance model
          const baseModel = { ...instance.model };

          // Reset contamination-prone fields
          const resetFields = {
            modelName: null,
            baseUrl: getDefaultBaseUrl(provider),
            endpoint: null,
            region: null,
            customHeaders: null,
            customProvider: null,
          };

          // Build final model config
          const finalModel = {
            ...baseModel,
            ...resetFields,
            ...(savedProviderConfig || {}),
            // Only override invocation parameters if we have saved config
            ...(savedProviderConfig && {
              invocationParameters: [
                ...savedProviderConfig.invocationParameters,
                ...(responseFormatInvocationParameter
                  ? [responseFormatInvocationParameter]
                  : []),
              ],
            }),
            provider,
          };

          return finalModel;
        })(),
        toolChoice:
          safelyConvertToolChoiceToProvider({
            toolChoice: instance.toolChoice,
            targetProvider: provider,
          }) ?? undefined,
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
      set(
        {
          allInstanceMessages: {
            ...get().allInstanceMessages,
            ...messageMapPatch,
          },
          dirtyInstances: {
            ...get().dirtyInstances,
            [instanceId]: true,
          },
          instances: instances.map((instance) => {
            if (instance.id === instanceId) {
              return {
                ...instance,
                ...patch,
              };
            }
            return instance;
          }),
        },
        false,
        { type: "updateProvider" }
      );
    },
    updateModel: ({ instanceId, patch }) => {
      const instances = get().instances;
      const instance = instances.find((instance) => instance.id === instanceId);
      if (!instance) {
        return;
      }
      set(
        {
          dirtyInstances: {
            ...get().dirtyInstances,
            [instanceId]: true,
          },
          instances: instances.map((instance) => {
            if (instance.id === instanceId) {
              return {
                ...instance,
                model: {
                  ...instance.model,
                  ...patch,
                },
              };
            }
            return instance;
          }),
        },
        false,
        { type: "updateModel" }
      );
    },
    deleteInstance: (instanceId: number) => {
      const instances = get().instances;
      set(
        {
          instances: instances.filter((instance) => instance.id !== instanceId),
          dirtyInstances: {
            ...get().dirtyInstances,
            [instanceId]: false,
          },
        },
        false,
        { type: "deleteInstance" }
      );
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
      set(
        {
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
          dirtyInstances: {
            ...get().dirtyInstances,
            [playgroundInstanceId]: true,
          },
          instances: instances.map((instance) => {
            if (
              instance.id === playgroundInstanceId &&
              instance?.template &&
              instance?.template.__type === "chat"
            ) {
              return {
                ...instance,
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
        },
        false,
        { type: "addMessage" }
      );
    },
    updateMessage: ({ messageId, patch, instanceId }) => {
      const allInstanceMessages = get().allInstanceMessages;
      set(
        {
          allInstanceMessages: {
            ...allInstanceMessages,
            [messageId]: {
              ...allInstanceMessages[messageId],
              ...patch,
            },
          },
          dirtyInstances: {
            ...get().dirtyInstances,
            [instanceId]: true,
          },
        },
        false,
        { type: "updateMessage" }
      );
    },
    deleteMessage: ({ instanceId, messageId }) => {
      const instances = get().instances;
      const allInstanceMessages = get().allInstanceMessages;
      set(
        {
          allInstanceMessages: Object.fromEntries(
            Object.entries(allInstanceMessages).filter(
              ([, { id }]) => id !== messageId
            )
          ),
          dirtyInstances: {
            ...get().dirtyInstances,
            [instanceId]: true,
          },
          instances: instances.map((instance) => {
            if (
              instance.id === instanceId &&
              instance?.template &&
              instance?.template.__type === "chat"
            ) {
              return {
                ...instance,
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
        },
        false,
        { type: "deleteMessage" }
      );
    },
    setSelectedRepetitionNumber: (
      instanceId: number,
      repetitionNumber: number
    ) => {
      const instances = get().instances;
      const instanceIndex = instances.findIndex(
        (instance) => instance.id === instanceId
      );
      if (instanceIndex === -1) {
        return;
      }
      set(
        {
          instances: instances.map((instance, idx) =>
            idx === instanceIndex
              ? { ...instance, selectedRepetitionNumber: repetitionNumber }
              : instance
          ),
        },
        false,
        { type: "setSelectedRepetitionNumber" }
      );
    },

    updateInstance: ({ instanceId, patch, dirty }) => {
      const instances = get().instances;
      set(
        {
          dirtyInstances: {
            ...get().dirtyInstances,
            ...(dirty != undefined ? { [instanceId]: dirty } : {}),
          },
          instances: instances.map((instance) => {
            if (instance.id === instanceId) {
              return {
                ...instance,
                ...patch,
              };
            }
            return instance;
          }),
        },
        false,
        { type: "updateInstance" }
      );
    },
    runPlaygroundInstances: () => {
      const instances = get().instances;
      const repetitions = get().repetitions;
      set(
        {
          instances: instances.map((instance) => ({
            ...instance,
            activeRunId: generateRunId(),
            repetitions: Object.fromEntries(
              Array.from({ length: repetitions }, (_, i) => [
                i + 1,
                {
                  output: null,
                  spanId: null,
                  error: null,
                  status: "pending",
                  toolCalls: {},
                },
              ])
            ),
            selectedRepetitionNumber: 1,
          })),
        },
        false,
        { type: "runPlaygroundInstances" }
      );
    },
    cancelPlaygroundInstances: () => {
      const instances = get().instances;
      set(
        {
          instances: instances.map((instance) => ({
            ...instance,
            activeRunId: null,
            repetitions: Object.fromEntries(
              Object.entries(instance.repetitions).map(
                ([repetitionNumber, repetition]) => [
                  repetitionNumber,
                  repetition
                    ? {
                        ...repetition,
                        status: "finished",
                      }
                    : undefined,
                ]
              )
            ),
          })),
        },
        false,
        { type: "cancelPlaygroundInstances" }
      );
    },
    markPlaygroundInstanceComplete: (instanceId: number) => {
      const instances = get().instances;
      set(
        {
          instances: instances.map((instance) => {
            if (instance.id === instanceId) {
              return {
                ...instance,
                activeRunId: null,
                repetitions: Object.fromEntries(
                  Object.entries(instance.repetitions).map(
                    ([repetitionNumber, repetition]) => {
                      return [
                        repetitionNumber,
                        repetition
                          ? {
                              ...repetition,
                              status: "finished",
                            }
                          : undefined,
                      ];
                    }
                  )
                ),
              };
            }
            return instance;
          }),
        },
        false,
        { type: "markPlaygroundInstanceComplete" }
      );
    },
    setTemplateFormat: (templateFormat: TemplateFormat) => {
      set({ templateFormat }, false, { type: "setTemplateFormat" });
    },
    setVariableValue: (key: string, value: string) => {
      const input = get().input;
      set(
        {
          input: {
            ...input,
            variablesValueCache: { ...input.variablesValueCache, [key]: value },
          },
        },
        false,
        { type: "setVariableValue" }
      );
    },
    setStreaming: (streaming: boolean) => {
      set({ streaming }, false, { type: "setStreaming" });
    },
    setRepetitions: (repetitions: number) => {
      set({ repetitions }, false, { type: "setRepetitions" });
    },
    setAppendedMessagesPath: (appendedMessagesPath: string | null) => {
      set({ appendedMessagesPath }, false, { type: "setAppendedMessagesPath" });
    },
    setTemplateVariablesPath: (templateVariablesPath: string | null) => {
      set({ templateVariablesPath }, false, {
        type: "setTemplateVariablesPath",
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
      set(
        {
          dirtyInstances: {
            ...get().dirtyInstances,
            [instanceId]: true,
          },
          instances: get().instances.map((instance) => {
            if (instance.id === instanceId) {
              return {
                ...instance,
                model: { ...instance.model, invocationParameters },
              };
            }
            return instance;
          }),
        },
        false,
        { type: "updateInstanceModelInvocationParameters" }
      );
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
        set(
          {
            dirtyInstances: {
              ...get().dirtyInstances,
              [instanceId]: true,
            },
            instances: get().instances.map((instance) => {
              if (instance.id === instanceId) {
                return {
                  ...instance,
                  model: {
                    ...instance.model,
                    invocationParameters:
                      instance.model.invocationParameters.map((p) =>
                        areInvocationParamsEqual(p, invocationParameterInput)
                          ? invocationParameterInput
                          : p
                      ),
                  },
                };
              }
              return instance;
            }),
          },
          false,
          { type: "upsertInvocationParameterInput/update" }
        );
      } else {
        set(
          {
            dirtyInstances: {
              ...get().dirtyInstances,
              [instanceId]: true,
            },
            instances: get().instances.map((instance) => {
              if (instance.id === instanceId) {
                return {
                  ...instance,
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
          },
          false,
          { type: "upsertInvocationParameterInput/insert" }
        );
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
      set(
        {
          dirtyInstances: {
            ...get().dirtyInstances,
            [instanceId]: true,
          },
          instances: get().instances.map((instance) => {
            if (instance.id === instanceId) {
              return {
                ...instance,
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
        },
        false,
        { type: "deleteInvocationParameterInput" }
      );
    },
    setDirty: (instanceId: number, dirty: boolean) => {
      set(
        {
          dirtyInstances: {
            ...get().dirtyInstances,
            [instanceId]: dirty,
          },
        },
        false,
        { type: "setDirty" }
      );
    },
    appendRepetitionOutput: (
      instanceId: number,
      repetitionNumber: number,
      content: string
    ) => {
      const instances = get().instances;
      const instance = instances.find((instance) => instance.id === instanceId);
      if (!instance) {
        return;
      }
      set(
        {
          instances: instances.map((instance) => {
            if (instance.id === instanceId) {
              const repetition = instance.repetitions[repetitionNumber];
              return {
                ...instance,
                repetitions: {
                  ...instance.repetitions,
                  [repetitionNumber]: repetition
                    ? {
                        ...repetition,
                        output: (repetition.output || "") + content,
                      }
                    : undefined,
                },
              };
            }
            return instance;
          }),
        },
        false,
        { type: "appendRepetitionOutput" }
      );
    },
    setRepetitionError: (
      instanceId: number,
      repetitionNumber: number,
      error: PlaygroundError
    ) => {
      set(
        {
          instances: get().instances.map((instance) => {
            if (instance.id !== instanceId) {
              return instance;
            }
            const repetition = instance.repetitions[repetitionNumber];
            const updated = {
              ...instance,
              repetitions: {
                ...instance.repetitions,
                [repetitionNumber]: repetition
                  ? {
                      ...repetition,
                      error,
                    }
                  : undefined,
              },
            };
            return updated;
          }),
        },
        false,
        { type: "setRepetitionError" }
      );
    },
    setRepetitionStatus: (
      instanceId: number,
      repetitionNumber: number,
      status: PlaygroundRepetitionStatus
    ) => {
      set(
        {
          instances: get().instances.map((instance) => {
            if (instance.id !== instanceId) {
              return instance;
            }
            const repetition = instance.repetitions[repetitionNumber];
            const updated = {
              ...instance,
              repetitions: {
                ...instance.repetitions,
                [repetitionNumber]: repetition
                  ? {
                      ...repetition,
                      status,
                    }
                  : undefined,
              },
            };
            return updated;
          }),
        },
        false,
        { type: "setRepetitionStatus" }
      );
    },
    addRepetitionPartialToolCall: (
      instanceId: number,
      repetitionNumber: number,
      partialToolCall: PartialOutputToolCall
    ) => {
      set(
        {
          instances: get().instances.map((instance) => {
            if (instance.id !== instanceId) {
              return instance;
            }
            const repetition = instance.repetitions[repetitionNumber];
            const toolCalls = repetition?.toolCalls ?? {};
            const updatedToolCalls =
              partialToolCall.id in toolCalls
                ? {
                    ...toolCalls,
                    [partialToolCall.id]: {
                      ...toolCalls[partialToolCall.id],
                      function: {
                        ...partialToolCall.function,
                        arguments:
                          toolCalls[partialToolCall.id].function.arguments +
                          partialToolCall.function.arguments,
                      },
                    },
                  }
                : {
                    ...toolCalls,
                    [partialToolCall.id]: partialToolCall,
                  };
            return {
              ...instance,
              repetitions: {
                ...instance.repetitions,
                [repetitionNumber]: repetition
                  ? {
                      ...repetition,
                      toolCalls: updatedToolCalls,
                    }
                  : undefined,
              },
            };
          }),
        },
        false,
        { type: "addRepetitionPartialToolCall" }
      );
    },
    setRepetitionToolCalls: (
      instanceId: number,
      repetitionNumber: number,
      toolCalls: PartialOutputToolCall[]
    ) => {
      set(
        {
          instances: get().instances.map((instance) => {
            if (instance.id !== instanceId) {
              return instance;
            }
            const repetition = instance.repetitions[repetitionNumber];
            const toolCallsById = toolCalls.reduce(
              (acc, toolCall) => {
                acc[toolCall.id] = toolCall;
                return acc;
              },
              {} as Record<string, PartialOutputToolCall>
            );
            return {
              ...instance,
              repetitions: {
                ...instance.repetitions,
                [repetitionNumber]: repetition
                  ? {
                      ...repetition,
                      toolCalls: toolCallsById,
                    }
                  : undefined,
              },
            };
          }),
        },
        false,
        { type: "setRepetitionToolCalls" }
      );
    },
    clearRepetitions: (instanceId: number) => {
      set(
        {
          instances: get().instances.map((instance) => {
            if (instance.id !== instanceId) {
              return instance;
            }
            return {
              ...instance,
              repetitions: {},
            };
          }),
        },
        false,
        { type: "clearRepetitions" }
      );
    },
    setRepetitionSpanId: (
      instanceId: number,
      repetitionNumber: number,
      spanId: string
    ) => {
      set(
        {
          instances: get().instances.map((instance) => {
            if (instance.id !== instanceId) {
              return instance;
            }
            const repetition = instance.repetitions[repetitionNumber];
            return {
              ...instance,
              repetitions: {
                ...instance.repetitions,
                [repetitionNumber]: repetition
                  ? {
                      ...repetition,
                      spanId,
                    }
                  : undefined,
              },
            };
          }),
        },
        false,
        { type: "setRepetitionSpanId" }
      );
    },
    initExperimentRunProgress: (instanceId, progress) => {
      set(
        {
          instances: get().instances.map((instance) => {
            if (instance.id !== instanceId) {
              return instance;
            }
            return {
              ...instance,
              experimentRunProgress: progress,
            };
          }),
        },
        false,
        { type: "initExperimentRunProgress" }
      );
    },
    incrementRunsCompleted: (instanceId) => {
      set(
        {
          instances: get().instances.map((instance) => {
            if (instance.id !== instanceId || !instance.experimentRunProgress) {
              return instance;
            }
            return {
              ...instance,
              experimentRunProgress: {
                ...instance.experimentRunProgress,
                runsCompleted: instance.experimentRunProgress.runsCompleted + 1,
              },
            };
          }),
        },
        false,
        { type: "incrementRunsCompleted" }
      );
    },
    incrementRunsFailed: (instanceId) => {
      set(
        {
          instances: get().instances.map((instance) => {
            if (instance.id !== instanceId || !instance.experimentRunProgress) {
              return instance;
            }
            return {
              ...instance,
              experimentRunProgress: {
                ...instance.experimentRunProgress,
                runsFailed: instance.experimentRunProgress.runsFailed + 1,
              },
            };
          }),
        },
        false,
        { type: "incrementRunsFailed" }
      );
    },
    incrementEvalsCompleted: (instanceId) => {
      set(
        {
          instances: get().instances.map((instance) => {
            if (instance.id !== instanceId || !instance.experimentRunProgress) {
              return instance;
            }
            return {
              ...instance,
              experimentRunProgress: {
                ...instance.experimentRunProgress,
                evalsCompleted:
                  instance.experimentRunProgress.evalsCompleted + 1,
              },
            };
          }),
        },
        false,
        { type: "incrementEvalsCompleted" }
      );
    },
    incrementEvalsFailed: (instanceId) => {
      set(
        {
          instances: get().instances.map((instance) => {
            if (instance.id !== instanceId || !instance.experimentRunProgress) {
              return instance;
            }
            return {
              ...instance,
              experimentRunProgress: {
                ...instance.experimentRunProgress,
                evalsFailed: instance.experimentRunProgress.evalsFailed + 1,
              },
            };
          }),
        },
        false,
        { type: "incrementEvalsFailed" }
      );
    },
    clearExperimentRunProgress: (instanceId) => {
      set(
        {
          instances: get().instances.map((instance) => {
            if (instance.id !== instanceId) {
              return instance;
            }
            return {
              ...instance,
              experimentRunProgress: null,
            };
          }),
        },
        false,
        { type: "clearExperimentRunProgress" }
      );
    },
  });
  return create(devtools(playgroundStore, { name: "playgroundStore" }));
};

export type PlaygroundStore = ReturnType<typeof createPlaygroundStore>;
