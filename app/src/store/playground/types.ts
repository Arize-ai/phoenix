import { z } from "zod";

import { InvocationParameter } from "@phoenix/components/playground/model/InvocationParametersFormFields";
import { TemplateFormat } from "@phoenix/components/templateEditor/types";
import { InvocationParameterInput } from "@phoenix/pages/playground/__generated__/PlaygroundOutputSubscription.graphql";
import type { chatMessageSchema } from "@phoenix/pages/playground/schemas";
import { LlmProviderToolDefinition } from "@phoenix/schemas";
import { PhoenixToolEditorType } from "@phoenix/schemas/phoenixToolTypeSchemas";
import {
  AnthropicToolChoice,
  GoogleToolChoice,
  OpenaiToolChoice,
} from "@phoenix/schemas/toolChoiceSchemas";

import { ModelConfigByProvider } from "../preferencesStore";
export type GenAIOperationType = "chat" | "text_completion";
import type { PartialOutputToolCall } from "@phoenix/pages/playground/PlaygroundToolCall";

/**
 * A chat message with a role and content
 * @example { role: "user", content: "What is the weather in San Francisco?" }
 * @example
 * ```typescript
 * {
 *   "role": "assistant",
 *   "toolCalls": [
 *     {
 *       "id": "1",
 *       "function": {
 *         "name": "getCurrentWeather",
 *         "arguments": "{ \"city\": \"San Francisco\" }"
 *       }
 *     }
 *   ]
 * }
 * ```
 */
export type ChatMessage = z.infer<typeof chatMessageSchema>;

/**
 * A template for a chat completion playground
 * Takes a list of messages for multi-turn
 * @see https://platform.openai.com/docs/guides/chat-completions
 */
export type PlaygroundChatTemplate = {
  __type: "chat";
  messages: ChatMessage[];
};

/**
 * A template for a text completion playground
 * A single prompt for text completion
 */
export type PlaygroundTextCompletionTemplate = {
  __type: "text_completion";
  prompt: string;
};

/**
 * A playground template can be a chat completion or text completion (legacy)
 */
export type PlaygroundTemplate =
  | PlaygroundChatTemplate
  | PlaygroundTextCompletionTemplate;

export type PlaygroundInput = {
  variablesValueCache?: Record<string, string | undefined>;
};

export type PlaygroundError = {
  title: string;
  message?: string;
};

export type ModelConfig = {
  provider: ModelProvider;
  modelName: string | null;
  baseUrl?: string | null;
  endpoint?: string | null;
  /**
   * The region of the deployment (e.x. us-east-1 for AWS Bedrock)
   */
  region?: string | null;
  /**
   * Custom headers to be sent with requests to the LLM provider
   */
  customHeaders?: Record<string, string> | null;
  /**
   * The ID of the custom provider if using a custom provider configuration.
   * When set, the request will use the custom provider instead of the built-in provider.
   */
  customProviderId?: string | null;
  invocationParameters: (InvocationParameterInput & { dirty?: boolean })[];
  supportedInvocationParameters: InvocationParameter[];
};

export type ModelInvocationParameterInput =
  ModelConfig["invocationParameters"][number];

/**
 * The type of a tool in the playground
 */
export type Tool = {
  id: number;
  editorType: PhoenixToolEditorType;
  definition: LlmProviderToolDefinition;
};

export type PlaygroundInstancePrompt = {
  /**
   * The relay global id of the prompt
   */
  id: string;
  /**
   * The name (Identifier) of the prompt
   */
  name: string;
  /**
   * The version of the prompt.
   */
  version: string;
  /**
   * The selected tag, if any
   */
  tag: string | null;
};

export type PlaygroundRepetitionStatus =
  | "notStarted"
  | "pending" // awaiting first token in streaming mode or awaiting response in non-streaming mode
  | "streamInProgress" // only in streaming mode
  | "finished"; // includes error states

type ToolCallId = string;

export type PlaygroundRepetition = {
  output: ChatMessage[] | string | null;
  toolCalls: Record<ToolCallId, PartialOutputToolCall>;
  spanId: string | null;
  error: PlaygroundError | null;
  status: PlaygroundRepetitionStatus;
};

/**
 * A single instance of the playground that has
 * - a template
 * - tools
 * - output the output of running the playground or the initial data loaded from a span or dataset
 */
export interface PlaygroundInstance {
  /**
   * An ID to uniquely identify the instance
   */
  id: number;
  template: PlaygroundTemplate;
  tools: Tool[];
  /**
   * How the LLM should choose the tool to use
   * @default "auto"
   */
  toolChoice?: OpenaiToolChoice | AnthropicToolChoice | GoogleToolChoice;
  model: ModelConfig;
  repetitions: Record<number, PlaygroundRepetition | undefined>;
  activeRunId: number | null;
  /**
   * The id of the experiment associated with the last playground run on the instance if any
   */
  experimentId?: string | null;
  /**
   * Details about the prompt hub prompt associated with the instance, if any
   */
  prompt?: PlaygroundInstancePrompt | null;
  /**
   * The selected repetition number for the instance
   */
  selectedRepetitionNumber: number;
  /**
   * Progress tracking for dataset experiment runs
   */
  experimentRunProgress?: {
    totalRuns: number;
    runsCompleted: number;
    runsFailed: number;
    totalEvals: number;
    evalsCompleted: number;
    evalsFailed: number;
  } | null;
}

/**
 * All actions for a playground instance must contain the id of the instance
 */
interface PlaygroundInstanceActionParams {
  playgroundInstanceId: number;
}

export interface AddMessageParams extends PlaygroundInstanceActionParams {
  /**
   * If not provided, a default empty message will be added
   */
  messages?: ChatMessage[];
}

export interface PlaygroundProps {
  /**
   * How the LLM API should be invoked. Distinguishes between chat and text_completion.
   * @see https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-spans/
   * @default "chat"
   */
  operationType: GenAIOperationType;
  /**
   * The input to all the playground instances
   */
  input: PlaygroundInput;
  /**
   * The current playground instances(s)
   * Defaults to a single instance until a second instance is added
   */
  instances: Array<PlaygroundInstance>;
  /**
   * The current template format for all instances
   * @default "MUSTACHE"
   */
  templateFormat: TemplateFormat;
  /**
   * Whether or not to use streaming
   * @default true
   */
  streaming: boolean;
  /**
   * The number of repetitions for the playground
   * @default 1
   */
  repetitions: number;
}

export type InitialPlaygroundState = Partial<PlaygroundProps> & {
  modelConfigByProvider: ModelConfigByProvider;
};

/**
 * A chat completion template, with normalized message ids
 *
 * The chat template only contains references to message ids, which are normalized to be unique
 * and stored elsewhere in the state
 */
export type PlaygroundNormalizedChatTemplate = Omit<
  PlaygroundChatTemplate,
  "messages"
> & {
  messageIds: number[];
};

/**
 * A playground instance, with normalized chat completion template messages
 */
export type PlaygroundNormalizedInstance = Omit<
  PlaygroundInstance,
  "template"
> & {
  template: PlaygroundTextCompletionTemplate | PlaygroundNormalizedChatTemplate;
};

export interface PlaygroundState extends Omit<PlaygroundProps, "instances"> {
  instances: Array<PlaygroundNormalizedInstance>;

  /**
   * A map of message id to message
   *
   * message ids must be globally unique across all instances
   */
  allInstanceMessages: Record<number, ChatMessage>;

  /**
   * A map of instance id to whether the instance is dirty
   */
  dirtyInstances: Record<number, boolean>;

  /**
   * Setter for the invocation mode
   * @param operationType
   */
  setOperationType: (operationType: GenAIOperationType) => void;
  /**
   * The input for the playground. Setting a datasetId will cause the playground to use the dataset as input
   * The variablesValueCache will be set and maintained even when switching between dataset and manual input
   * This allows the user to switch between dataset and manual input without losing the manual input values
   */
  input: PlaygroundInput;
  /**
   * Sets the input for the playground
   */
  setInput: (input: PlaygroundInput) => void;
  /**
   * Add a comparison instance to the playground
   */
  addInstance: () => void;
  /**
   * Delete a specific instance of the playground
   * @param instanceId the instance to delete
   */
  deleteInstance: (instanceId: number) => void;
  /**
   * Add a message to a playground instance
   */
  addMessage: (params: AddMessageParams) => void;
  /**
   * Update a message in a playground instance
   */
  updateMessage: (params: {
    instanceId: number;
    messageId: number;
    patch: Partial<ChatMessage>;
  }) => void;
  /**
   * Delete a message from a playground instance
   */
  deleteMessage: (params: { instanceId: number; messageId: number }) => void;

  /**
   * Update an instance of the playground
   */
  updateInstance: (params: {
    instanceId: number;
    patch: Partial<PlaygroundNormalizedInstance>;
    /**
     * Should this update mark the instance as dirty?
     *
     * null means the dirty state should not be changed
     */
    dirty: boolean | null;
  }) => void;
  /**
   * Update the invocation parameters for a model
   */
  updateInstanceModelInvocationParameters: (params: {
    instanceId: number;
    invocationParameters: InvocationParameterInput[];
  }) => void;
  /**
   * Upsert an invocation parameter input for a model
   */
  upsertInvocationParameterInput: (params: {
    instanceId: number;
    invocationParameterInput: InvocationParameterInput;
  }) => void;
  /**
   * Delete an invocation parameter input for a model
   */
  deleteInvocationParameterInput: (params: {
    instanceId: number;
    invocationParameterInputInvocationName: string;
  }) => void;
  /**
   * Update the supported invocation parameters for a model
   */
  updateModelSupportedInvocationParameters: (params: {
    instanceId: number;
    supportedInvocationParameters: InvocationParameter[];
    modelConfigByProvider: ModelConfigByProvider;
  }) => void;
  /**
   * Update an instances model provider, transforming various aspects about the instance to fit the new provider if possible
   * Also attempts to use the saved model configurations for providers as the default parameters for the new provider
   */
  updateProvider: (params: {
    instanceId: number;
    provider: ModelProvider;
    /**
     * The saved model configurations for providers. These will be used as the default parameters for the new provider if the provider is changed
     */
    modelConfigByProvider: ModelConfigByProvider;
  }) => void;
  /**
   * Update an instance's model configuration excluding the provider and invocation parameters
   */
  updateModel: (params: {
    instanceId: number;
    patch: Partial<Omit<ModelConfig, "provider" | "invocationParameters">>;
  }) => void;
  /**
   * Run all the active playground Instances
   */
  runPlaygroundInstances: () => void;
  /**
   * Cancel all the active playground Instances
   */
  cancelPlaygroundInstances: () => void;
  /**
   * Mark a given playground instance as completed
   */
  markPlaygroundInstanceComplete: (instanceId: number) => void;
  /**
   * Set the template form  at for all instances
   */
  setTemplateFormat: (templateFormat: TemplateFormat) => void;
  /**
   * Set the value of a variable in the input
   */
  setVariableValue: (key: string, value: string) => void;
  /**
   * set the streaming mode for the playground
   */
  setStreaming: (streaming: boolean) => void;
  /**
   * set the repetitions for the playground
   */
  setRepetitions: (repetitions: number) => void;
  /**
   * Set the dirty state of an instance
   */
  setDirty: (instanceId: number, dirty: boolean) => void;
  /**
   * Set the selected repetition number for an instance, which controls the currently displayed repetition
   */
  setSelectedRepetitionNumber: (
    instanceId: number,
    repetitionNumber: number
  ) => void;
  /**
   * Append a content chunk to the output of an instance
   */
  appendRepetitionOutput: (
    instanceId: number,
    repetitionNumber: number,
    content: string
  ) => void;
  /**
   * Set the error for a repetition
   */
  setRepetitionError: (
    instanceId: number,
    repetitionNumber: number,
    error: PlaygroundError
  ) => void;
  /**
   * Set the span id for a repetition
   */
  setRepetitionSpanId: (
    instanceId: number,
    repetitionNumber: number,
    spanId: string
  ) => void;
  /**
   * Set the status for a repetition
   */
  setRepetitionStatus: (
    instanceId: number,
    repetitionNumber: number,
    status: PlaygroundRepetitionStatus
  ) => void;
  /**
   * Add a partial tool call to a repetition
   * If the tool call already exists, it will be updated with the new arguments
   * If the tool call does not exist, it will be added
   */
  addRepetitionPartialToolCall: (
    instanceId: number,
    repetitionNumber: number,
    toolCall: PartialOutputToolCall
  ) => void;
  /**
   * Set the tool calls for a repetition
   */
  setRepetitionToolCalls: (
    instanceId: number,
    repetitionNumber: number,
    toolCalls: PartialOutputToolCall[]
  ) => void;
  /**
   * Clears all repetitions for an instance
   */
  clearRepetitions: (instanceId: number) => void;
  /**
   * Update experiment run progress for an instance
   */
  updateExperimentRunProgress: (params: {
    instanceId: number;
    progress: {
      totalRuns: number;
      runsCompleted: number;
      runsFailed: number;
      totalEvals: number;
      evalsCompleted: number;
      evalsFailed: number;
    };
  }) => void;
}
