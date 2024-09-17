import { create, StateCreator } from "zustand";
import { devtools, persist } from "zustand/middleware";

import { LastNTimeRangeKey } from "@phoenix/components/datetime/types";

export type MarkdownDisplayMode = "text" | "markdown";

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
   * Whether or not to show the span aside that contains details about timing, status, etc.
   * @default true
   */
  showSpanAside: boolean;
  /**
   * Whether or not the trace tree shows metrics
   */
  showMetricsInTraceTree: boolean;
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
   * Setter for enabling/disabling the span aside
   * @param showSpanAside
   */
  setShowSpanAside: (showSpanAside: boolean) => void;
  /**
   * Setter for enabling/disabling metrics in the trace tree
   * @param showMetricsInTraceTree
   */
  setShowMetricsInTraceTree: (showMetricsInTraceTree: boolean) => void;
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
    showSpanAside: true,
    setShowSpanAside: (showSpanAside) => {
      set({ showSpanAside });
    },
    showMetricsInTraceTree: true,
    setShowMetricsInTraceTree: (showMetricsInTraceTree) => {
      set({ showMetricsInTraceTree });
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
