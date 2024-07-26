import { create, StateCreator } from "zustand";
import { devtools, persist } from "zustand/middleware";

export type MarkdownDisplayMode = "text" | "markdown";

export interface PreferencesProps {
  /**
   * The display mode of markdown text
   * @default "text"
   */
  markdownDisplayMode: MarkdownDisplayMode;
}

export interface PreferencesState extends PreferencesProps {
  /**
   * Sets the display mode of markdown text
   * @param markdownDisplayMode
   */
  setMarkdownDisplayMode: (markdownDisplayMode: MarkdownDisplayMode) => void;
  /**
   * Whether or not streaming is enabled for a projects traces
   * @default true
   */
  traceStreamingEnabled: boolean;
  /**
   * Setter for enabling/disabling trace streaming
   * @param traceStreamingEnabled
   * @returns
   */
  setTraceStreamingEnabled: (traceStreamingEnabled: boolean) => void;
}

export const createPreferencesStore = (
  initialProps?: Partial<PreferencesProps>
) => {
  const preferencesStore: StateCreator<PreferencesState> = (set) => ({
    ...initialProps,
    markdownDisplayMode: "text",
    setMarkdownDisplayMode: (markdownDisplayMode) => {
      set({ markdownDisplayMode });
    },
    traceStreamingEnabled: true,
    setTraceStreamingEnabled: (traceStreamingEnabled) => {
      set({ traceStreamingEnabled });
    },
  });
  return create<PreferencesState>()(
    persist(devtools(preferencesStore), {
      name: "arize-phoenix-preferences",
    })
  );
};

export type PreferencesStore = ReturnType<typeof createPreferencesStore>;
