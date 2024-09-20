import { create, StateCreator } from "zustand";
import { devtools } from "zustand/middleware";

export type GenAIOperationType = "chat" | "text_completion";

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
 * A chat message with a role and content
 * @example { role: "user", content: "What is the meaning of life?" }
 */
export type ChatMessage = {
  role: string;
  content: string;
};

/**
 * A template for a chat completion playground
 * Takes a list of messages for multi-turn
 * @see https://platform.openai.com/docs/guides/chat-completions
 */
export type PlaygroundChatTemplate = {
  messages: ChatMessage[];
};

export type PlaygroundTextCompletionTemplate = {
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
  instances: Array<PlaygroundInstance | undefined>;
}

/**
 * A single instance of the playground that has
 * - a template
 * - tools
 * - input (dataset or manual)
 * - output (experiment or spans)
 */
export interface PlaygroundInstance {
  template: PlaygroundTemplate;
  tools: unknown;
  input: unknown;
  output: unknown;
}

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
}

const DEFAULT_CHAT_COMPLETION_TEMPLATE: PlaygroundChatTemplate = {
  messages: [
    {
      role: "system",
      content: "You are a chatbot",
    },
    {
      role: "user",
      content: "{question}",
    },
  ],
};

const DEFAULT_TEXT_COMPLETION_TEMPLATE: PlaygroundTextCompletionTemplate = {
  prompt: "What is the meaning of life?",
};

export const createPlaygroundStore = (
  initialProps?: Partial<PlaygroundProps>
) => {
  const playgroundStore: StateCreator<PlaygroundState> = (set, get) => ({
    operationType: "chat",
    inputMode: "manual",
    setInputMode: (inputMode: PlaygroundInputMode) => set({ inputMode }),
    instances: [
      {
        template: DEFAULT_CHAT_COMPLETION_TEMPLATE,
        tools: {},
        input: {},
        output: {},
      },
    ],
    setOperationType: (operationType: GenAIOperationType) => {
      if (operationType === "chat") {
        // TODO: this is incorrect, it should only change the template
        set({
          instances: [
            {
              template: DEFAULT_CHAT_COMPLETION_TEMPLATE,
              tools: {},
              input: {},
              output: {},
            },
          ],
        });
      } else {
        set({
          instances: [
            {
              template: DEFAULT_TEXT_COMPLETION_TEMPLATE,
              tools: {},
              input: {},
              output: {},
            },
          ],
        });
      }
      set({ operationType });
    },
    addInstance: () => {
      const instance = get().instances[0];
      if (!instance) {
        return;
      }
      // For now just hard-coded to two instances
      set({
        instances: [
          instance,
          {
            ...instance,
          },
        ],
      });
    },
    ...initialProps,
  });
  return create(devtools(playgroundStore));
};

export type PlaygroundStore = ReturnType<typeof createPlaygroundStore>;
