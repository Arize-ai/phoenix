import {
  createContext,
  PropsWithChildren,
  startTransition,
  useCallback,
  useContext,
  useState,
} from "react";

import { usePreferencesContext } from "./PreferencesContext";

export type StreamStateContextType = {
  /**
   * Whether or not streaming is enabled.
   * @default true
   */
  isStreaming: boolean;
  /**
   * Enables or disables streaming.
   */
  setIsStreaming: (isStreaming: boolean) => void;
  /**
   * The fetch key for the current data.
   * E.g. this acts as a unique identifier for the data
   * It can be the count of traces or a hash of the data
   */
  fetchKey: string;
  /**
   * Sets the fetchKey to force a refetch
   */
  setFetchKey: (fetchKey: string) => void;
};

export const StreamStateContext = createContext<StreamStateContextType | null>(
  null
);

export function useStreamState() {
  const context = useContext(StreamStateContext);
  if (context === null) {
    throw new Error("useStreamState must be used within a StreamStateProvider");
  }
  return context;
}

export function StreamStateProvider({
  initialFetchKey = "initial",
  children,
}: PropsWithChildren<{ initialFetchKey?: string }>) {
  const isStreaming = usePreferencesContext(
    (state) => state.traceStreamingEnabled
  );
  const setIsStreaming = usePreferencesContext(
    (state) => state.setTraceStreamingEnabled
  );
  const [fetchKey, _setFetchKey] = useState<string>(initialFetchKey);

  const setFetchKey = useCallback(
    (fetchKey: string) => {
      startTransition(() => {
        _setFetchKey(fetchKey);
      });
    },
    [_setFetchKey]
  );
  return (
    <StreamStateContext.Provider
      value={{ isStreaming, setIsStreaming, fetchKey, setFetchKey }}
    >
      {children}
    </StreamStateContext.Provider>
  );
}
