import { TemplateLanguage } from "@phoenix/components/templateEditor/types";
import { InvocationParameterInput } from "@phoenix/pages/playground/__generated__/PlaygroundOutputSubscription.graphql";
import { InvocationParameter } from "@phoenix/pages/playground/InvocationParametersFormFields";
import {
  LlmProviderToolCall,
  LlmProviderToolDefinition,
} from "@phoenix/schemas";

import { ModelConfigByProvider } from "../preferencesStore";
export type GenAIOperationType = "chat" | "text_completion";

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
export type ChatMessage = {
  id: number;
  role: ChatMessageRole;
  // Tool call messages may not have content
  content?: string;
  toolCalls?: LlmProviderToolCall[];
  toolCallId?: string;
};

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

export type ModelConfig = {
  provider: ModelProvider;
  modelName: string | null;
  baseUrl?: string | null;
  endpoint?: string | null;
  apiVersion?: string | null;
  invocationParameters: InvocationParameterInput[];
  supportedInvocationParameters: InvocationParameter[];
};

/**
 * The type of a tool in the playground
 */
export type Tool = {
  id: number;
  definition: LlmProviderToolDefinition;
};

export type PlaygroundInstancePrompt = {
  /**
   * The id of the prompt
   */
  id: string;
  /**
   * The version of the prompt. Assumes latest version if not provided.
   */
  version?: string;
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
  toolChoice?: ToolChoice;
  model: ModelConfig;
  output?: ChatMessage[] | string;
  spanId: string | null;
  activeRunId: number | null;
  /**
   * The id of the experiment associated with the last playground run on the instance if any
   */
  experimentId?: string | null;
  /**
   * Details about the prompt hub prompt associated with the instance, if any
   */
  prompt?: PlaygroundInstancePrompt;
}

/**
 * All actions for a playground instance must contain the id of the instance
 */
interface PlaygroundInstanceActionParams {
  playgroundInstanceId: number;
}

export interface AddMessageParams extends PlaygroundInstanceActionParams {}

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
   * The current template language for all instances
   * @default "mustache"
   */
  templateLanguage: TemplateLanguage;
  /**
   * Whether or not to use streaming
   * @default true
   */
  streaming: boolean;
}

export type InitialPlaygroundState = Partial<PlaygroundProps> & {
  modelConfigByProvider: ModelConfigByProvider;
};

export interface PlaygroundState extends PlaygroundProps {
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
   * Update an instance of the playground
   */
  updateInstance: (params: {
    instanceId: number;
    patch: Partial<PlaygroundInstance>;
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
   * Set the template language for all instances
   */
  setTemplateLanguage: (templateLanguage: TemplateLanguage) => void;
  /**
   * Set the value of a variable in the input
   */
  setVariableValue: (key: string, value: string) => void;
  /**
   * set the streaming mode for the playground
   */
  setStreaming: (streaming: boolean) => void;
  /**
   * Update the prompt details for an instance
   */
  updateInstancePrompt: (params: {
    instanceId: number;
    patch: Partial<PlaygroundInstancePrompt> | null;
  }) => void;
}
