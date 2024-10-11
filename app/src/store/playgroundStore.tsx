import { create, StateCreator } from "zustand";
import { devtools } from "zustand/middleware";

export type GenAIOperationType = "chat" | "text_completion";

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

/**
 * The input mode for the playground
 * @example "manual" or "dataset"
 */
export type PlaygroundInputMode = "manual" | "dataset";

/**
 * A playground template can be a chat completion or text completion (legacy)
 */
export type PlaygroundTemplate =
  | PlaygroundChatTemplate
  | PlaygroundTextCompletionTemplate;

/**
 * Array of roles for a chat message with a LLM
 */
export enum ChatMessageRole {
  system = "system",
  user = "user",
  tool = "tool",
  ai = "ai",
}

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

export type PlaygroundTextCompletionTemplate = {
  __type: "text_completion";
  prompt: string;
};

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
   * The current playground instances(s)
   * Defaults to a single instance until a second instance is added
   */
  instances: Array<PlaygroundInstance>;
}

export type InitialPlaygroundState = Partial<PlaygroundProps>;

type DatasetInput = {
  datasetId: string;
};

type ManualInput = {
  variables: Record<string, string>;
};

type PlaygroundInput = DatasetInput | ManualInput;

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
  input: PlaygroundInput;
  output: ChatMessage[] | undefined | string;
  activeRunId: number | null;
  /**
   * Whether or not the playground instance is actively running or not
   **/
  isRunning: boolean;
}

/**
 * All actions for a playground instance must contain the index of the playground
 */
interface PlaygroundInstanceActionParams {
  playgroundInstanceId: number;
}
interface AddMessageParams extends PlaygroundInstanceActionParams {}

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
}

const generateChatCompletionTemplate = (): PlaygroundChatTemplate => ({
  __type: "chat",
  messages: [
    {
      id: generateMessageId(),
      role: ChatMessageRole.system,
      content: "You are a chatbot",
    },
    {
      id: generateMessageId(),
      role: ChatMessageRole.user,
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
    tools: {},
    input: { variables: {} },
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
    setInputMode: (inputMode: PlaygroundInputMode) => set({ inputMode }),
    instances: [createPlaygroundInstance()],
    setOperationType: (operationType: GenAIOperationType) => {
      if (operationType === "chat") {
        // TODO: this is incorrect, it should only change the template
        set({
          instances: [
            {
              id: generateInstanceId(),
              template: generateChatCompletionTemplate(),
              tools: {},
              input: { variables: {} },
              output: undefined,
              activeRunId: null,
              isRunning: false,
            },
          ],
        });
      } else {
        set({
          instances: [
            {
              id: generateInstanceId(),
              template: DEFAULT_TEXT_COMPLETION_TEMPLATE,
              tools: {},
              input: { variables: {} },
              output: undefined,
              activeRunId: null,
              isRunning: false,
            },
          ],
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
    ...initialProps,
  });
  return create(devtools(playgroundStore));
};

export type PlaygroundStore = ReturnType<typeof createPlaygroundStore>;
