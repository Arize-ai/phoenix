import type { StateCreator } from "zustand";
import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

import { TemplateFormats } from "@phoenix/components/templateEditor/constants";
import type { TemplateFormat } from "@phoenix/components/templateEditor/types";
import {
  DEFAULT_CHAT_ROLE,
  DEFAULT_MODEL_NAME,
  DEFAULT_MODEL_PROVIDER,
} from "@phoenix/constants/generativeConstants";
import type { PartialOutputToolCall } from "@phoenix/pages/playground/PlaygroundToolCall";
import {
  getDefaultInvocationConfig,
  parseInvocationConfig,
  writeInvocationConfigField,
} from "@phoenix/pages/playground/providerAdapters";

import { convertMessageToolCallsToProvider } from "./playgroundStoreUtils";
import {
  type ChatMessage,
  type ExperimentScaffold,
  type GenAIOperationType,
  type InitialPlaygroundState,
  type PlaygroundChatTemplate,
  type PlaygroundError,
  type PlaygroundInstance,
  type PlaygroundNormalizedChatTemplate,
  type PlaygroundNormalizedInstance,
  type PlaygroundRepetitionStatus,
  type PlaygroundState,
  PlaygroundStateByDatasetIdSchema,
  type PlaygroundTextCompletionTemplate,
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
    messages: template.messages.reduce<Record<number, ChatMessage>>(
      (acc, message) => {
        acc[message.id] = message;
        return acc;
      },
      {}
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
      invocationParameters: getDefaultInvocationConfig(DEFAULT_MODEL_PROVIDER),
    },
    tools: [],
    // Default to auto tool choice as you are probably testing the LLM for it's ability to pick
    toolChoice: { type: "ZERO_OR_MORE" },
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

  const preferredProvider =
    initialProps.defaultModelProvider ?? DEFAULT_MODEL_PROVIDER;
  const preferredModelName =
    initialProps.defaultModelName ?? DEFAULT_MODEL_NAME;
  // Seed the instance with the user's preferred default provider/model so it
  // is used when no saved config exists for that provider.
  instance.model = {
    ...instance.model,
    provider: preferredProvider,
    modelName: preferredModelName,
    invocationParameters: getDefaultInvocationConfig(preferredProvider),
  };

  const savedModelConfigs = Object.values(initialProps.modelConfigByProvider);
  const hasSavedModelConfig = savedModelConfigs.length > 0;
  if (!hasSavedModelConfig) {
    return {
      instances: [instance],
      instanceMessages,
    };
  }
  // A saved per-provider config (e.g. last-used invocation params for the
  // preferred provider) takes precedence over the bare user preference. When
  // the user has explicitly set a preferred provider but has no saved config
  // for it, keep the bare user preference rather than falling back to an
  // unrelated provider's saved config.
  const savedPreferredProviderConfig = savedModelConfigs.find(
    (config) => config.provider === preferredProvider
  );
  const savedConfigToUse =
    savedPreferredProviderConfig ??
    (initialProps.defaultModelProvider == null
      ? savedModelConfigs[0]
      : undefined);
  if (savedConfigToUse) {
    instance.model = {
      ...instance.model,
      ...savedConfigToUse,
      invocationParameters: parseInvocationConfig(
        savedConfigToUse.provider,
        savedConfigToUse.invocationParameters
      ),
    };
  }
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
    recordExperiments: true,
    nextExperimentScaffold: null,
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
    ...props,
    instances,
    allInstanceMessages: instanceMessages,
    externallyUpdatedMessageRevisionById: {},
    externallyUpdatedToolRevisionById: {},
    stateByDatasetId: props.stateByDatasetId
      ? props.stateByDatasetId
      : props.datasetId
        ? {
            [props.datasetId]: {
              templateVariablesPath: DEFAULT_TEMPLATE_VARIABLES_PATH,
              maxConcurrency: DEFAULT_MAX_CONCURRENCY,
            },
          }
        : {},
    initialSelectedDatasetEvaluatorIds:
      props.selectedDatasetEvaluatorIds ?? null,
    datasetId: props.datasetId ?? null,
    setDatasetId: (datasetId: string | null) => {
      set({ datasetId }, false, { type: "setDatasetId" });
      if (!datasetId) {
        return;
      }
      const datasetState = get().stateByDatasetId[datasetId];
      if (datasetState) {
        return;
      }
      // initialize state to defaults when switching to a new dataset
      set(
        {
          stateByDatasetId: {
            ...get().stateByDatasetId,
            [datasetId]: {
              templateVariablesPath: DEFAULT_TEMPLATE_VARIABLES_PATH,
              maxConcurrency: DEFAULT_MAX_CONCURRENCY,
            },
          },
        },
        false,
        { type: "setDatasetId/initialize" }
      );
    },
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
        newMessageMap = copiedMessages.reduce<Record<number, ChatMessage>>(
          (acc, message) => {
            acc[message.id] = message;
            return acc;
          },
          {}
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
              experiment: null,
              repetitions: {},
            },
          ],
        },
        false,
        { type: "addInstance" }
      );
    },
    syncInvocationParametersWithSpecs: ({
      instanceId,
      modelConfigByProvider,
    }) => {
      const instances = get().instances;
      set(
        {
          instances: instances.map((instance) => {
            if (instance.id === instanceId) {
              const { baseUrl, endpoint, region } =
                modelConfigByProvider[instance.model.provider] ?? {};
              return {
                ...instance,
                model: {
                  ...instance.model,
                  baseUrl: instance.model.baseUrl ?? baseUrl,
                  endpoint: instance.model.endpoint ?? endpoint,
                  region: instance.model.region ?? region,
                },
              };
            }
            return instance;
          }),
        },
        false,
        { type: "syncInvocationParametersWithSpecs" }
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
      const functionTools = instance.tools.filter(
        (tool) => tool.kind === "function"
      );
      const functionToolNames = new Set(
        functionTools.map((tool) => tool.definition.name)
      );
      const toolChoice =
        functionTools.length === 0
          ? undefined
          : instance.toolChoice?.type === "SPECIFIC_FUNCTION" &&
              !functionToolNames.has(instance.toolChoice.functionName ?? "")
            ? { type: "ZERO_OR_MORE" as const }
            : (instance.toolChoice ?? undefined);

      // Set default baseUrl for OLLAMA if no saved config exists
      const getDefaultBaseUrl = (provider: ModelProvider) => {
        if (provider === "OLLAMA") {
          return "http://localhost:11434/v1";
        }
        return null;
      };

      const patch: Partial<PlaygroundNormalizedInstance> = {
        // A saved provider config wins on provider switch. Without one, start
        // from provider defaults so the new provider owns its own invocation
        // parameter semantics.
        model: (() => {
          // Keep unrelated model fields unless the provider switch below
          // deliberately resets them.
          const baseModel = { ...instance.model };
          // When switching providers without a saved config, start from the new
          // provider's defaults. Cross-provider scalar carry-over would require
          // explicit semantic mapping (e.g. whether a source provider's
          // temperature should apply to the new provider), so do not infer it
          // from shared field names.
          const invocationParameters = savedProviderConfig?.invocationParameters
            ? parseInvocationConfig(
                provider,
                savedProviderConfig.invocationParameters
              )
            : getDefaultInvocationConfig(provider);

          // Routing fields are provider-specific and must be rebuilt for the
          // selected provider.
          const resetFields = {
            modelName: null,
            baseUrl: getDefaultBaseUrl(provider),
            endpoint: null,
            region: null,
            customHeaders: null,
            customProvider: null,
            openaiApiType: null,
          };

          // Merge saved provider fields last, then force the selected provider
          // and normalized invocation parameters.
          const finalModel = {
            ...baseModel,
            ...resetFields,
            ...(savedProviderConfig || {}),
            invocationParameters,
            // responseFormat is canonical (provider-agnostic) — carry through if present
            ...(instance.model.responseFormat != null
              ? { responseFormat: instance.model.responseFormat }
              : {}),
            provider,
          };

          return finalModel;
        })(),
        toolChoice,
        tools: functionTools,
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
      const shouldDropRawTools =
        patch.openaiApiType !== undefined &&
        patch.openaiApiType !== instance.model.openaiApiType;
      const tools = shouldDropRawTools
        ? instance.tools.filter((tool) => tool.kind === "function")
        : instance.tools;
      const functionToolNames = new Set(
        tools
          .filter((tool) => tool.kind === "function")
          .map((tool) => tool.definition.name)
      );
      const toolChoice =
        tools.length === 0
          ? undefined
          : instance.toolChoice?.type === "SPECIFIC_FUNCTION" &&
              !functionToolNames.has(instance.toolChoice.functionName ?? "")
            ? { type: "ZERO_OR_MORE" as const }
            : instance.toolChoice;
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
                tools,
                toolChoice,
                model: {
                  ...instance.model,
                  ...patch,
                  invocationParameters: parseInvocationConfig(
                    instance.model.provider,
                    instance.model.invocationParameters
                  ),
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
            ...newMessages.reduce<Record<number, ChatMessage>>(
              (acc, message) => {
                acc[message.id] = message;
                return acc;
              },
              {}
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
            ...(dirty != null ? { [instanceId]: dirty } : {}),
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
    markToolsExternallyUpdated: (toolIds) => {
      if (toolIds.length === 0) return;
      set(
        (state) => {
          const next = { ...state.externallyUpdatedToolRevisionById };
          for (const toolId of toolIds) {
            next[toolId] = (next[toolId] ?? 0) + 1;
          }
          return { externallyUpdatedToolRevisionById: next };
        },
        false,
        { type: "markToolsExternallyUpdated" }
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
    setVariableValues: (values: { key: string; value: string }[]) => {
      const input = get().input;
      const variableValues = Object.fromEntries(
        values.map(({ key, value }) => [key, value])
      );
      set(
        {
          input: {
            ...input,
            variablesValueCache: {
              ...input.variablesValueCache,
              ...variableValues,
            },
          },
        },
        false,
        { type: "setVariableValues" }
      );
    },
    setStreaming: (streaming: boolean) => {
      set({ streaming }, false, { type: "setStreaming" });
    },
    setRepetitions: (repetitions: number) => {
      set({ repetitions }, false, { type: "setRepetitions" });
    },
    setRecordExperiments: (recordExperiments: boolean) => {
      set({ recordExperiments }, false, { type: "setRecordExperiments" });
    },
    setNextExperimentScaffold: (
      nextExperimentScaffold: ExperimentScaffold | null
    ) => {
      set({ nextExperimentScaffold }, false, {
        type: "setNextExperimentScaffold",
      });
    },
    consumeNextExperimentScaffold: () => {
      const { nextExperimentScaffold } = get();
      if (nextExperimentScaffold != null) {
        set({ nextExperimentScaffold: null }, false, {
          type: "consumeNextExperimentScaffold",
        });
      }
      return nextExperimentScaffold;
    },
    setMaxConcurrency: ({
      maxConcurrency,
      datasetId,
    }: {
      maxConcurrency: number;
      datasetId: string;
    }) => {
      set(
        {
          stateByDatasetId: {
            ...get().stateByDatasetId,
            [datasetId]: {
              ...get().stateByDatasetId[datasetId],
              maxConcurrency,
            },
          },
        },
        false,
        { type: "setMaxConcurrency" }
      );
    },
    setAppendedMessagesPath: ({
      path,
      datasetId,
    }: {
      path: string | null;
      datasetId: string;
    }) => {
      set(
        {
          stateByDatasetId: {
            ...get().stateByDatasetId,
            [datasetId]: {
              ...get().stateByDatasetId[datasetId],
              appendedMessagesPath: path,
            },
          },
        },
        false,
        {
          type: "setAppendedMessagesPath",
        }
      );
    },
    setTemplateVariablesPath: ({
      templateVariablesPath,
      datasetId,
    }: {
      templateVariablesPath: string | null;
      datasetId: string;
    }) => {
      set(
        {
          stateByDatasetId: {
            ...get().stateByDatasetId,
            [datasetId]: {
              ...get().stateByDatasetId[datasetId],
              templateVariablesPath: templateVariablesPath,
            },
          },
        },
        false,
        {
          type: "setTemplateVariablesPath",
        }
      );
    },
    setAvailablePaths: ({
      availablePaths,
      datasetId,
    }: {
      availablePaths: string[];
      datasetId: string;
    }) => {
      set(
        {
          stateByDatasetId: {
            ...get().stateByDatasetId,
            [datasetId]: {
              ...get().stateByDatasetId[datasetId],
              availablePaths,
            },
          },
        },
        false,
        {
          type: "setAvailablePaths",
        }
      );
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
                model: {
                  ...instance.model,
                  invocationParameters,
                },
              };
            }
            return instance;
          }),
        },
        false,
        { type: "updateInstanceModelInvocationParameters" }
      );
    },
    setInvocationParameterField: ({ instanceId, fieldName, value }) => {
      const instance = get().instances.find((i) => i.id === instanceId);
      if (!instance) {
        return;
      }
      const canonical = writeInvocationConfigField(
        instance.model.provider,
        instance.model.invocationParameters,
        fieldName,
        value
      );
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
                  invocationParameters: canonical,
                },
              };
            }
            return instance;
          }),
        },
        false,
        {
          type:
            value === undefined
              ? "setInvocationParameterField/clear"
              : "setInvocationParameterField/set",
        }
      );
    },
    setResponseFormat: ({ instanceId, responseFormat }) => {
      set(
        {
          dirtyInstances: { ...get().dirtyInstances, [instanceId]: true },
          instances: get().instances.map((instance) => {
            if (instance.id !== instanceId) return instance;
            return {
              ...instance,
              model: { ...instance.model, responseFormat },
            };
          }),
        },
        false,
        { type: "setResponseFormat" }
      );
    },
    deleteResponseFormat: ({ instanceId }) => {
      set(
        {
          dirtyInstances: { ...get().dirtyInstances, [instanceId]: true },
          instances: get().instances.map((instance) => {
            if (instance.id !== instanceId) return instance;
            const { responseFormat: _removed, ...modelWithout } =
              instance.model;
            return { ...instance, model: modelWithout };
          }),
        },
        false,
        { type: "deleteResponseFormat" }
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
            const existingToolCall = toolCalls[partialToolCall.id];
            const updatedToolCalls =
              partialToolCall.id in toolCalls
                ? {
                    ...toolCalls,
                    [partialToolCall.id]: {
                      ...existingToolCall,
                      function: {
                        name:
                          existingToolCall.function?.name ??
                          partialToolCall.function.name,
                        arguments:
                          (existingToolCall.function?.arguments ?? "") +
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
            const toolCallsById = toolCalls.reduce<
              Record<string, PartialOutputToolCall>
            >((acc, toolCall) => {
              acc[toolCall.id] = toolCall;
              return acc;
            }, {});
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
    setRepetitionTraceId: (
      instanceId: number,
      repetitionNumber: number,
      traceId: string
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
                      traceId,
                    }
                  : undefined,
              },
            };
          }),
        },
        false,
        { type: "setRepetitionTraceId" }
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
    setInstanceExperiment: (instanceId, experiment) => {
      set(
        {
          instances: get().instances.map((instance) => {
            if (instance.id !== instanceId) {
              return instance;
            }
            return {
              ...instance,
              experiment,
            };
          }),
        },
        false,
        { type: "setInstanceExperiment" }
      );
    },
  });

  return create(
    persist(devtools(playgroundStore, { name: "playgroundStore" }), {
      name: "arize-phoenix-playground",
      partialize: (state) => {
        // Exclude availablePaths from persistence - it's computed at runtime
        const filteredState: typeof state.stateByDatasetId = {};
        for (const [datasetId, datasetState] of Object.entries(
          state.stateByDatasetId
        )) {
          const { availablePaths: _, ...rest } = datasetState;
          filteredState[datasetId] = rest;
        }
        return {
          stateByDatasetId: filteredState,
          recordExperiments: state.recordExperiments,
        };
      },
      merge: (persistedState, currentState) => {
        try {
          const persisted = persistedState as Record<string, unknown>;
          // Handle both old format (flat record) and new format (object with stateByDatasetId)
          const stateByDatasetId = persisted?.stateByDatasetId
            ? PlaygroundStateByDatasetIdSchema.parse(persisted.stateByDatasetId)
            : PlaygroundStateByDatasetIdSchema.parse(persistedState);
          const merged = {
            ...currentState,
            stateByDatasetId: {
              ...currentState.stateByDatasetId,
              ...stateByDatasetId,
            },
            recordExperiments:
              (persisted?.recordExperiments as boolean) ??
              currentState.recordExperiments,
          };

          return merged;
        } catch {
          return currentState;
        }
      },
    })
  );
};

export const DEFAULT_TEMPLATE_VARIABLES_PATH = "input";
export const DEFAULT_MAX_CONCURRENCY = 10;

export type PlaygroundStore = ReturnType<typeof createPlaygroundStore>;
