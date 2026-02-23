import type { StateCreator } from "zustand";
import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

import type { LastNTimeRangeKey } from "@phoenix/components/datetime/types";
import type { ProgrammingLanguage } from "@phoenix/types/code";
import { getSupportedTimezones } from "@phoenix/utils/timeUtils";

import type { ModelConfig } from "./playground";

export type MarkdownDisplayMode = "text" | "markdown";

export const awsBedrockModelPrefixes = [
  "",
  "apac",
  "au",
  "ca",
  "eu",
  "global",
  "il",
  "jp",
  "us",
  "us-gov",
] as const;

export type AwsBedrockModelPrefix = (typeof awsBedrockModelPrefixes)[number];

export type ModelConfigByProvider = Partial<
  Record<
    ModelProvider,
    Omit<ModelConfig, "supportedInvocationParameters" | "customProvider">
  >
>;

export type ProjectViewMode = "table" | "grid";

export type ProjectSortOrder = {
  column: "name" | "endTime";
  direction: "asc" | "desc";
};

export type DisplayTimezone = string;

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
  /**
   * Whether the side nav is open or closed
   * @default true
   */
  isSideNavExpanded: boolean;
  /**
   * The timezone to display timestamps in
   * @default undefined - use the browser's local timezone
   */
  displayTimezone?: DisplayTimezone;
  /**
   * The preferred programming language for code snippets
   * @default "Python"
   */
  programmingLanguage: ProgrammingLanguage;
  /**
   * The AWS Bedrock cross-region inference model prefix
   * @default "us"
   * @see https://docs.aws.amazon.com/bedrock/latest/userguide/inference-profiles-support.html
   */
  awsBedrockModelPrefix: AwsBedrockModelPrefix;
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
  /**
   * Setter for the side nav open state
   */
  setIsSideNavExpanded: (isSideNavExpanded: boolean) => void;
  /**
   * Setter for the display timezone
   */
  setDisplayTimezone: (displayTimezone: DisplayTimezone | undefined) => void;
  /**
   * Setter for the preferred programming language
   */
  setProgrammingLanguage: (programmingLanguage: ProgrammingLanguage) => void;
  /**
   * Setter for the AWS Bedrock model prefix
   */
  setAwsBedrockModelPrefix: (
    awsBedrockModelPrefix: AwsBedrockModelPrefix
  ) => void;
}

export const createPreferencesStore = (
  initialProps?: Partial<PreferencesProps>
) => {
  const preferencesStore: StateCreator<
    PreferencesState,
    [["zustand/devtools", unknown]]
  > = (set) => ({
    markdownDisplayMode: "text",
    setMarkdownDisplayMode: (markdownDisplayMode) => {
      set({ markdownDisplayMode }, false, { type: "setMarkdownDisplayMode" });
    },
    traceStreamingEnabled: true,
    setTraceStreamingEnabled: (traceStreamingEnabled) => {
      set({ traceStreamingEnabled }, false, {
        type: "setTraceStreamingEnabled",
      });
    },
    lastNTimeRangeKey: "7d",
    setLastNTimeRangeKey: (lastNTimeRangeKey) => {
      set({ lastNTimeRangeKey });
    },
    projectsAutoRefreshEnabled: true,
    setProjectAutoRefreshEnabled: (projectsAutoRefreshEnabled) => {
      set({ projectsAutoRefreshEnabled }, false, {
        type: "setProjectAutoRefreshEnabled",
      });
    },
    showMetricsInTraceTree: true,
    setShowMetricsInTraceTree: (showMetricsInTraceTree) => {
      set({ showMetricsInTraceTree }, false, {
        type: "setShowMetricsInTraceTree",
      });
    },
    modelConfigByProvider: {},
    setModelConfigForProvider: ({ provider, modelConfig }) => {
      set(
        (state) => {
          return {
            modelConfigByProvider: {
              ...state.modelConfigByProvider,
              [provider]: modelConfig,
            },
          };
        },
        false,
        { type: "setModelConfigForProvider" }
      );
    },
    playgroundStreamingEnabled: true,
    setPlaygroundStreamingEnabled: (playgroundStreamingEnabled) => {
      set({ playgroundStreamingEnabled }, false, {
        type: "setPlaygroundStreamingEnabled",
      });
    },
    isAnnotatingSpans: true,
    setIsAnnotatingSpans: (isAnnotatingSpans) => {
      set({ isAnnotatingSpans }, false, { type: "setIsAnnotatingSpans" });
    },
    projectViewMode: "grid",
    setProjectViewMode: (projectViewMode) => {
      set({ projectViewMode }, false, { type: "setProjectViewMode" });
    },
    projectSortOrder: {
      column: "endTime",
      direction: "desc",
    },
    setProjectSortOrder: (projectSortOrder) => {
      set({ projectSortOrder }, false, { type: "setProjectSortOrder" });
    },
    isSideNavExpanded: true,
    setIsSideNavExpanded: (isSideNavExpanded) => {
      set({ isSideNavExpanded }, false, { type: "setIsSideNavExpanded" });
    },
    setDisplayTimezone: (displayTimezone) => {
      // Just to be extra safe of what we store in local storage.
      if (
        displayTimezone &&
        !getSupportedTimezones().includes(displayTimezone)
      ) {
        throw new Error(`Invalid timezone: ${displayTimezone}`);
      }
      set({ displayTimezone }, false, { type: "setDisplayTimezone" });
    },
    programmingLanguage: "Python",
    setProgrammingLanguage: (programmingLanguage) => {
      set({ programmingLanguage }, false, { type: "setProgrammingLanguage" });
    },
    awsBedrockModelPrefix: "us",
    setAwsBedrockModelPrefix: (awsBedrockModelPrefix) => {
      set({ awsBedrockModelPrefix }, false, {
        type: "setAwsBedrockModelPrefix",
      });
    },
    ...initialProps,
  });
  return create<PreferencesState>()(
    persist(devtools(preferencesStore, { name: "preferencesStore" }), {
      name: "arize-phoenix-preferences",
    })
  );
};

export type PreferencesStore = ReturnType<typeof createPreferencesStore>;
