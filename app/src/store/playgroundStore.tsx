import { create, StateCreator } from "zustand";
import { devtools } from "zustand/middleware";

export type InvocationMode = "chat" | "completion";
export interface PlaygroundProps {
  /**
   * How the LLM API should be invoked. Distinguishes between chat and completion.
   * @default "chat"
   */
  invocationMode: InvocationMode;
}

export interface PlaygroundState extends PlaygroundProps {
  /**
   * Setter for the invocation mode
   * @param invocationMode
   */
  setInvocationMode: (invocationMode: InvocationMode) => void;
}

export const createPlaygroundStore = (
  initialProps?: Partial<PlaygroundProps>
) => {
  const playgroundStore: StateCreator<PlaygroundState> = (set) => ({
    invocationMode: "chat",
    setInvocationMode: (invocationMode: InvocationMode) =>
      set({ invocationMode }),
    ...initialProps,
  });
  return create(devtools(playgroundStore));
};

export type PlaygroundStore = ReturnType<typeof createPlaygroundStore>;
