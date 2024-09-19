import { create, StateCreator } from "zustand";
import { devtools } from "zustand/middleware";

export type GenAIOperationType = "chat" | "text_completion";
export interface PlaygroundProps {
  /**
   * How the LLM API should be invoked. Distinguishes between chat and text_completion.
   * @see https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-spans/
   * @default "chat"
   */
  operationType: GenAIOperationType;
}

export type PlaygroundTemplate =
  | PlaygroundChatTemplate
  | PlaygroundTextCompletionTemplate;

export type ChatMessage = {
  role: string;
  content: string;
};

export type PlaygroundChatTemplate = {
  messages: ChatMessage[];
};
export type PlaygroundTextCompletionTemplate = {
  prompt: string;
};

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
   * The current playground(s)
   * Defaults to a single instance until a second instance is added
   */
  playgrounds: Array<PlaygroundInstance | undefined>;
}

const DEFAULT_CHAT_COMPLETION_TEMPLATE: PlaygroundChatTemplate = {
  messages: [
    {
      role: "system",
      content: "You are a chatbot",
    },
    {
      role: "user",
      content: "What is the meaning of life?",
    },
  ],
};

const DEFAULT_TEXT_COMPLETION_TEMPLATE: PlaygroundTextCompletionTemplate = {
  prompt: "What is the meaning of life?",
};

export const createPlaygroundStore = (
  initialProps?: Partial<PlaygroundProps>
) => {
  const playgroundStore: StateCreator<PlaygroundState> = (set) => ({
    operationType: "chat",
    playgrounds: [
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
          playgrounds: [
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
          playgrounds: [
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
    ...initialProps,
  });
  return create(devtools(playgroundStore));
};

export type PlaygroundStore = ReturnType<typeof createPlaygroundStore>;
