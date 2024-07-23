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
  });
  return create<PreferencesState>()(
    persist(devtools(preferencesStore), {
      name: "arize-phoenix-preferences",
    })
  );
};

export type PreferencesStore = ReturnType<typeof createPreferencesStore>;
