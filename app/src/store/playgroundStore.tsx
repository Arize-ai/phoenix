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

export interface PlaygroundState extends PlaygroundProps {
  /**
   * Setter for the invocation mode
   * @param operationType
   */
  setOperationType: (operationType: GenAIOperationType) => void;
}

export const createPlaygroundStore = (
  initialProps?: Partial<PlaygroundProps>
) => {
  const playgroundStore: StateCreator<PlaygroundState> = (set) => ({
    operationType: "chat",
    setOperationType: (operationType: GenAIOperationType) =>
      set({ operationType }),
    ...initialProps,
  });
  return create(devtools(playgroundStore));
};

export type PlaygroundStore = ReturnType<typeof createPlaygroundStore>;
