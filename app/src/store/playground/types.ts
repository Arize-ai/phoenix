import { TemplateLanguage } from "@phoenix/components/templateEditor/types";

export type GenAIOperationType = "chat" | "text_completion";
/**
 * The input mode for the playground
 * @example "manual" or "dataset"
 */
export type PlaygroundInputMode = "manual" | "dataset";

/**
 * A chat message with a role and content
 * @example { role: "user", content: "What is the meaning of life?" }
 */
export type ChatMessage = {
  id: number;
  role: ChatMessageRole;
  content: string;
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

type DatasetInput = {
  datasetId: string;
};

type ManualInput = {
  variables: Record<string, string>;
};

type PlaygroundInput = DatasetInput | ManualInput;

type ModelConfig = {
  provider: ModelProvider;
  modelName: string | null;
};

/**
 * A single instance of the playground that has
 * - a template
 * - tools
 * - input (dataset or manual)
 * - output (experiment or spans)
 */
export interface PlaygroundInstance {
  /**
   * An ID to uniquely identify the instance
   */
  id: number;
  template: PlaygroundTemplate;
  tools: unknown;
  model: ModelConfig;
  output: ChatMessage[] | undefined | string;
  activeRunId: number | null;
  /**
   * Whether or not the playground instance is actively running or not
   **/
  isRunning: boolean;
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
   * The input mode for the playground(s)
   * NB: the input mode for all instances is synchronized
   * @default "manual"
   */
  inputMode: PlaygroundInputMode;
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
}

export type InitialPlaygroundState = Partial<PlaygroundProps>;

export interface PlaygroundState extends PlaygroundProps {
  /**
   * Setter for the invocation mode
   * @param operationType
   */
  setOperationType: (operationType: GenAIOperationType) => void;
  /**
   * Setter for the input mode.
   */
  setInputMode: (inputMode: PlaygroundInputMode) => void;
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
   * Update an instance's model configuration
   */
  updateModel: (params: {
    instanceId: number;
    model: Partial<ModelConfig>;
  }) => void;
  /**
   * Run all the active playground Instances
   */
  runPlaygroundInstances: () => void;
  /**
   * Run a specific playground instance
   */
  runPlaygroundInstance: (instanceId: number) => void;
  /**
   * Mark a given playground instance as completed
   */
  markPlaygroundInstanceComplete: (instanceId: number) => void;
  /**
   * Set the template language for all instances
   */
  setTemplateLanguage: (templateLanguage: TemplateLanguage) => void;
  /**
   * Calculate the variables used across all instances
   */
  calculateVariables: () => void;
}
