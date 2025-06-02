import { create, StateCreator } from "zustand";
import { devtools, persist } from "zustand/middleware";

import { LastNTimeRangeKey } from "@phoenix/components/datetime/types";

import { ModelConfig } from "./playground";

export type MarkdownDisplayMode = "text" | "markdown";

export type ModelConfigByProvider = Partial<
  Record<ModelProvider, Omit<ModelConfig, "supportedInvocationParameters">>
>;

export type ProjectViewMode = "table" | "grid";

export type ProjectSortOrder = {
  column: "name" | "endTime";
  direction: "asc" | "desc";
};

export interface PreferencesProps {
  /**
   * The display mode of markdown text
   * @default "text"
   */
  markdownDisplayMode: MarkdownDisplayMode;
  /**
   * Whether or not streaming is enabled for a projects traces
   * @default true
   */
  traceStreamingEnabled: boolean;
  /**
   * The last N time range to load data for
   */
  lastNTimeRangeKey: LastNTimeRangeKey;
  /**
   * Whether or not to automatically refresh projects
   * @default true
   */
  projectsAutoRefreshEnabled: boolean;
  /**
   * Whether or not the trace tree shows metrics
   */
  showMetricsInTraceTree: boolean;
  /**
   * {@link ModelConfig|ModelConfigs} for llm providers will be used as the default parameters for the provider
   */
  modelConfigByProvider: ModelConfigByProvider;
  /**
   * Whether or not the playground is in streaming mode
   * Note: this is always false in environments that do not support streaming
   */
  playgroundStreamingEnabled: boolean;
  /**
   * Whether or not the span details are in annotating mode
   */
  isAnnotatingSpans: boolean;
  /**
   * The view mode for projects
   */
  projectViewMode: ProjectViewMode;
  /**
   * The sort order for projects
   */
  projectSortOrder: ProjectSortOrder;
}

export interface PreferencesState extends PreferencesProps {
  /**
   * Sets the display mode of markdown text
   * @param markdownDisplayMode
   */
  setMarkdownDisplayMode: (markdownDisplayMode: MarkdownDisplayMode) => void;
  /**
   * Setter for enabling/disabling trace streaming
   * @param traceStreamingEnabled
   */
  setTraceStreamingEnabled: (traceStreamingEnabled: boolean) => void;
  /**
   * Setter for the last N time range to load data for
   */
  setLastNTimeRangeKey: (lastNTimeRangeKey: LastNTimeRangeKey) => void;
  /**
   * Setter for enabling/disabling project auto refresh
   * @param projectsAutoRefreshEnabled
   */
  setProjectAutoRefreshEnabled: (projectsAutoRefreshEnabled: boolean) => void;
  /**
   * Setter for enabling/disabling metrics in the trace tree
   * @param showMetricsInTraceTree
   */
  setShowMetricsInTraceTree: (showMetricsInTraceTree: boolean) => void;
  /**
   * Setter for the model configs by provider
   */
  setModelConfigForProvider: ({
    provider,
    modelConfig,
  }: {
    provider: ModelProvider;
    modelConfig: Omit<ModelConfig, "supportedInvocationParameters">;
  }) => void;
  /**
   * Setter for enabling/disabling playground streaming
   */
  setPlaygroundStreamingEnabled: (playgroundStreamingEnabled: boolean) => void;
  /**
   * Setter for enabling/disabling span annotating
   */
  setIsAnnotatingSpans: (isAnnotatingSpans: boolean) => void;
  /**
   * Setter for the project view mode
   */
  setProjectViewMode: (projectViewMode: ProjectViewMode) => void;
  /**
   * Setter for the project sort order
   */
  setProjectSortOrder: (projectSortOrder: ProjectSortOrder) => void;
}

export const createPreferencesStore = (
  initialProps?: Partial<PreferencesProps>
) => {
  const preferencesStore: StateCreator<PreferencesState> = (set) => ({
    markdownDisplayMode: "text",
    setMarkdownDisplayMode: (markdownDisplayMode) => {
      set({ markdownDisplayMode });
    },
    traceStreamingEnabled: true,
    setTraceStreamingEnabled: (traceStreamingEnabled) => {
      set({ traceStreamingEnabled });
    },
    lastNTimeRangeKey: "7d",
    setLastNTimeRangeKey: (lastNTimeRangeKey) => {
      set({ lastNTimeRangeKey });
    },
    projectsAutoRefreshEnabled: true,
    setProjectAutoRefreshEnabled: (projectsAutoRefreshEnabled) => {
      set({ projectsAutoRefreshEnabled });
    },
    showMetricsInTraceTree: true,
    setShowMetricsInTraceTree: (showMetricsInTraceTree) => {
      set({ showMetricsInTraceTree });
    },
    modelConfigByProvider: {},
    setModelConfigForProvider: ({ provider, modelConfig }) => {
      set((state) => {
        return {
          modelConfigByProvider: {
            ...state.modelConfigByProvider,
            [provider]: modelConfig,
          },
        };
      });
    },
    playgroundStreamingEnabled: true,
    setPlaygroundStreamingEnabled: (playgroundStreamingEnabled) => {
      set({ playgroundStreamingEnabled });
    },
    isAnnotatingSpans: true,
    setIsAnnotatingSpans: (isAnnotatingSpans) => {
      set({ isAnnotatingSpans });
    },
    projectViewMode: "grid",
    setProjectViewMode: (projectViewMode) => {
      set({ projectViewMode });
    },
    projectSortOrder: {
      column: "endTime",
      direction: "desc",
    },
    setProjectSortOrder: (projectSortOrder) => {
      set({ projectSortOrder });
    },
    ...initialProps,
  });
  return create<PreferencesState>()(
    persist(devtools(preferencesStore), {
      name: "arize-phoenix-preferences",
    })
  );
};

export type PreferencesStore = ReturnType<typeof createPreferencesStore>;
