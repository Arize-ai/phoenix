import React, { useState } from "react";
import { useZustand } from "use-zustand";
import { create, StateCreator } from "zustand";

import { PlaygroundDatasetExamplesTableSubscription$data } from "./__generated__/PlaygroundDatasetExamplesTableSubscription.graphql";
import { PartialOutputToolCall } from "./PlaygroundToolCall";

type InstanceId = number;
export type ExampleId = string;
export type RepetitionNumber = number;
type ChatCompletionSubscriptionResult = Extract<
  PlaygroundDatasetExamplesTableSubscription$data["chatCompletionOverDataset"],
  { __typename: "ChatCompletionSubscriptionResult" }
>;
export type Span = NonNullable<ChatCompletionSubscriptionResult["span"]>;

type ToolCallChunk = Extract<
  PlaygroundDatasetExamplesTableSubscription$data["chatCompletionOverDataset"],
  { __typename: "ToolCallChunk" }
>;

type ExperimentRunEvaluation = NonNullable<
  Extract<
    PlaygroundDatasetExamplesTableSubscription$data["chatCompletionOverDataset"],
    { __typename: "EvaluationChunk" }
  >["experimentRunEvaluation"]
>;

export type ExampleRunData = {
  content?: string | null;
  toolCalls?: Record<string, PartialOutputToolCall | undefined>;
  evaluations?: ExperimentRunEvaluation[];
  span?: Span | null;
  errorMessage?: string | null;
  experimentRunId?: string | null;
};

export type InstanceResponses = Record<
  ExampleId,
  Record<RepetitionNumber, ExampleRunData | undefined>
>;

export type InstanceToExampleResponsesMap = Record<
  InstanceId,
  InstanceResponses | undefined
>;

type PlaygroundDatasetExamplesTableActions = {
  updateExampleData: (args: {
    instanceId: InstanceId;
    exampleId: ExampleId;
    repetitionNumber: RepetitionNumber;
    patch: Partial<ExampleRunData>;
  }) => void;
  appendExampleDataTextChunk: (args: {
    instanceId: InstanceId;
    exampleId: ExampleId;
    repetitionNumber: RepetitionNumber;
    textChunk: string;
  }) => void;
  appendExampleDataToolCallChunk: (args: {
    instanceId: InstanceId;
    exampleId: ExampleId;
    repetitionNumber: RepetitionNumber;
    toolCallChunk: ToolCallChunk;
  }) => void;
  appendExampleDataEvaluationChunk: (args: {
    instanceId: InstanceId;
    exampleId: ExampleId;
    repetitionNumber: RepetitionNumber;
    evaluationChunk: ExperimentRunEvaluation;
  }) => void;
  setExampleDataForInstance: (args: {
    data: InstanceResponses;
    instanceId: InstanceId;
  }) => void;
  resetData: () => void;
  setRepetitions: (repetitions: number) => void;
};

type PlaygroundDatasetExamplesTableState = {
  exampleResponsesMap: InstanceToExampleResponsesMap;
  repetitions: number;
} & PlaygroundDatasetExamplesTableActions;

const createPlaygroundDatasetExamplesTableStore = () => {
  const playgroundDatasetExamplesTableStore: StateCreator<
    PlaygroundDatasetExamplesTableState
  > = (set, get) => ({
    exampleResponsesMap: {},
    repetitions: 1,
    updateExampleData: ({ instanceId, exampleId, repetitionNumber, patch }) => {
      const exampleResponsesMap = get().exampleResponsesMap;
      const instance = exampleResponsesMap[instanceId] ?? {};
      const examplesByRepetitionNumber = instance[exampleId] ?? {};
      const example = examplesByRepetitionNumber[repetitionNumber] ?? {};
      set({
        exampleResponsesMap: {
          ...exampleResponsesMap,
          [instanceId]: {
            ...instance,
            [exampleId]: {
              ...examplesByRepetitionNumber,
              [repetitionNumber]: {
                ...example,
                ...patch,
              },
            },
          },
        },
      });
    },
    appendExampleDataTextChunk: ({
      instanceId,
      exampleId,
      repetitionNumber,
      textChunk,
    }) => {
      const exampleResponsesMap = get().exampleResponsesMap;
      const instance = exampleResponsesMap[instanceId] ?? {};
      const examplesByRepetitionNumber = instance[exampleId] ?? {};
      const currentContent =
        examplesByRepetitionNumber[repetitionNumber]?.content ?? "";

      set({
        exampleResponsesMap: {
          ...exampleResponsesMap,
          [instanceId]: {
            ...instance,
            [exampleId]: {
              ...examplesByRepetitionNumber,
              [repetitionNumber]: {
                content: currentContent + textChunk,
              },
            },
          },
        },
      });
    },
    appendExampleDataToolCallChunk: ({
      instanceId,
      exampleId,
      repetitionNumber,
      toolCallChunk,
    }) => {
      const exampleResponsesMap = get().exampleResponsesMap;
      const instance = exampleResponsesMap[instanceId] ?? {};
      const examplesByRepetitionNumber = instance[exampleId] ?? {};
      const example = examplesByRepetitionNumber[repetitionNumber] ?? {};
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
              ...examplesByRepetitionNumber,
              [repetitionNumber]: {
                ...example,
                toolCalls: {
                  ...currentToolCalls,
                  [id]: updatedToolCall,
                },
              },
            },
          },
        },
      });
    },
    appendExampleDataEvaluationChunk: ({
      instanceId,
      exampleId,
      repetitionNumber,
      evaluationChunk,
    }) => {
      const exampleResponsesMap = get().exampleResponsesMap;
      const instance = exampleResponsesMap[instanceId] ?? {};
      const examplesByRepetitionNumber = instance[exampleId] ?? {};
      const example = examplesByRepetitionNumber[repetitionNumber] ?? {};
      const currentEvaluations = example.evaluations ?? [];
      const updatedEvaluations = [...currentEvaluations, evaluationChunk];
      set({
        exampleResponsesMap: {
          ...exampleResponsesMap,
          [instanceId]: {
            ...instance,
            [exampleId]: {
              ...examplesByRepetitionNumber,
              [repetitionNumber]: {
                ...example,
                evaluations: updatedEvaluations,
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
    resetData: () => {
      set({ exampleResponsesMap: {}, repetitions: 1 });
    },
    setRepetitions: (repetitions: number) => {
      set({ repetitions });
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
