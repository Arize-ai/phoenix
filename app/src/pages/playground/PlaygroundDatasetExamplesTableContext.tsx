import React, { useState } from "react";
import { useZustand } from "use-zustand";
import { create, StateCreator } from "zustand";

import { PlaygroundDatasetExamplesTableSubscription$data } from "./__generated__/PlaygroundDatasetExamplesTableSubscription.graphql";
import { PartialOutputToolCall } from "./PlaygroundToolCall";

type InstanceId = number;
export type ExampleId = string;
type ChatCompletionSubscriptionResult = Extract<
  PlaygroundDatasetExamplesTableSubscription$data["chatCompletionOverDataset"],
  { __typename: "ChatCompletionSubscriptionResult" }
>;
export type Span = NonNullable<ChatCompletionSubscriptionResult["span"]>;

type ToolCallChunk = Extract<
  PlaygroundDatasetExamplesTableSubscription$data["chatCompletionOverDataset"],
  { __typename: "ToolCallChunk" }
>;

export type ExampleRunData = {
  content?: string | null;
  toolCalls?: Record<string, PartialOutputToolCall | undefined>;
  span?: Span | null;
  errorMessage?: string | null;
  experimentRunId?: string | null;
};

export type InstanceResponses = Record<ExampleId, ExampleRunData | undefined>;

export type InstanceToExampleResponsesMap = Record<
  InstanceId,
  InstanceResponses | undefined
>;

type PlaygroundDatasetExamplesTableActions = {
  updateExampleData: (args: {
    instanceId: InstanceId;
    exampleId: ExampleId;
    patch: Partial<ExampleRunData>;
  }) => void;
  appendExampleDataTextChunk: (args: {
    instanceId: InstanceId;
    exampleId: ExampleId;
    textChunk: string;
  }) => void;
  appendExampleDataToolCallChunk: (args: {
    instanceId: InstanceId;
    exampleId: ExampleId;
    toolCallChunk: ToolCallChunk;
  }) => void;
  setExampleDataForInstance: (args: {
    data: InstanceResponses;
    instanceId: InstanceId;
  }) => void;
  resetExampleData: () => void;
};

type PlaygroundDatasetExamplesTableState = {
  exampleResponsesMap: InstanceToExampleResponsesMap;
} & PlaygroundDatasetExamplesTableActions;

const createPlaygroundDatasetExamplesTableStore = () => {
  const playgroundDatasetExamplesTableStore: StateCreator<
    PlaygroundDatasetExamplesTableState
  > = (set, get) => ({
    exampleResponsesMap: {},
    updateExampleData: ({ instanceId, exampleId, patch }) => {
      const exampleResponsesMap = get().exampleResponsesMap;
      const instance = exampleResponsesMap[instanceId] ?? {};
      const example = instance[exampleId] ?? {};
      set({
        exampleResponsesMap: {
          ...exampleResponsesMap,
          [instanceId]: {
            ...instance,
            [exampleId]: {
              ...example,
              ...patch,
            },
          },
        },
      });
    },
    appendExampleDataTextChunk: ({ instanceId, exampleId, textChunk }) => {
      const exampleResponsesMap = get().exampleResponsesMap;
      const instance = exampleResponsesMap[instanceId] ?? {};
      const example = instance[exampleId] ?? {};
      const currentContent = example.content ?? "";

      set({
        exampleResponsesMap: {
          ...exampleResponsesMap,
          [instanceId]: {
            ...instance,
            [exampleId]: {
              ...example,
              content: currentContent + textChunk,
            },
          },
        },
      });
    },
    appendExampleDataToolCallChunk: ({
      instanceId,
      exampleId,
      toolCallChunk,
    }) => {
      const exampleResponsesMap = get().exampleResponsesMap;
      const instance = exampleResponsesMap[instanceId] ?? {};
      const example = instance[exampleId] ?? {};
      const currentToolCalls = example.toolCalls ?? {};
      const { id, function: toolFunction } = toolCallChunk;
      const existingToolCall = currentToolCalls[id];
      const updatedToolCall: PartialOutputToolCall = {
        ...existingToolCall,
        id,
        function: {
          name: existingToolCall?.function?.name ?? toolFunction.name,
          arguments:
            existingToolCall?.function.arguments != null
              ? existingToolCall.function.arguments + toolFunction.arguments
              : toolFunction.arguments,
        },
      };

      set({
        exampleResponsesMap: {
          ...exampleResponsesMap,
          [instanceId]: {
            ...instance,
            [exampleId]: {
              ...example,
              toolCalls: {
                ...currentToolCalls,
                [id]: updatedToolCall,
              },
            },
          },
        },
      });
    },
    setExampleDataForInstance: ({ instanceId, data }) => {
      const exampleResponsesMap = get().exampleResponsesMap;
      set({
        exampleResponsesMap: {
          ...exampleResponsesMap,
          [instanceId]: data,
        },
      });
    },
    resetExampleData: () => {
      set({ exampleResponsesMap: {} });
    },
  });
  return create<PlaygroundDatasetExamplesTableState>()(
    playgroundDatasetExamplesTableStore
  );
};

type PlaygroundDatasetExamplesTableStore = ReturnType<
  typeof createPlaygroundDatasetExamplesTableStore
>;

export const PlaygroundDatasetExamplesTableContext =
  React.createContext<PlaygroundDatasetExamplesTableStore | null>(null);

export function PlaygroundDatasetExamplesTableProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [store] = useState(() => createPlaygroundDatasetExamplesTableStore());
  return (
    <PlaygroundDatasetExamplesTableContext.Provider value={store}>
      {children}
    </PlaygroundDatasetExamplesTableContext.Provider>
  );
}

export function usePlaygroundDatasetExamplesTableContext<T>(
  selector: (state: PlaygroundDatasetExamplesTableState) => T,
  equalityFn?: (left: T, right: T) => boolean
) {
  const store = React.useContext(PlaygroundDatasetExamplesTableContext);
  if (!store)
    throw new Error(
      "Missing PlaygroundDatasetExamplesTableContext.Provider in the tree"
    );
  return useZustand(store, selector, equalityFn);
}
