import React, { useState } from "react";
import { useZustand } from "use-zustand";
import type { StateCreator } from "zustand";
import { create } from "zustand";

import type { PlaygroundDatasetExamplesTableSubscription$data } from "./__generated__/PlaygroundDatasetExamplesTableSubscription.graphql";
import type { PartialOutputToolCall } from "./PlaygroundToolCall";

type InstanceId = number;
export type ExampleId = string;
export type RepetitionNumber = number;
type AnnotationName = string;
type ChatCompletionSubscriptionResult = Extract<
  PlaygroundDatasetExamplesTableSubscription$data["chatCompletionOverDataset"],
  { __typename: "ChatCompletionSubscriptionResult" }
>;
export type Span = NonNullable<ChatCompletionSubscriptionResult["span"]>;

type ToolCallChunk = Extract<
  PlaygroundDatasetExamplesTableSubscription$data["chatCompletionOverDataset"],
  { __typename: "ToolCallChunk" }
>;

export type EvaluationChunk = Extract<
  PlaygroundDatasetExamplesTableSubscription$data["chatCompletionOverDataset"],
  { __typename: "EvaluationChunk" }
>;

/**
 * A running sum/count used to compute a mean score incrementally.
 */
export type ExperimentRunAnnotationAggregateMetric = {
  sum: number;
  count: number;
};

/**
 * Running sums/counts for cost, latency, and token metrics per instance.
 * Each metric tracks its own count since any value can be null on a given run.
 */
export type ExperimentRunCostAggregateMetric = {
  runCount: number;
  latencySum: number;
  latencyCount: number;
  tokenCountSum: number;
  tokenCountCount: number;
  costSum: number;
  costCount: number;
};

/**
 * Represents an annotation score for a single experiment run.
 * Used for tracking annotated metrics (e.g., evaluator scores) for a given instance.
 */
export type ExperimentRunAnnotation = {
  instanceId: InstanceId;
  annotationName: AnnotationName;
  score: number | null;
};

/**
 * Represents cost, latency, and token metrics for a single experiment run.
 * Used for aggregating per-run LLM cost and performance data.
 */
export type ExperimentRunCost = {
  instanceId: InstanceId;
  latencyMs: number | null;
  tokenCountTotal: number | null;
  cost: number | null;
};

export type ExampleRunData = {
  content?: string | null;
  toolCalls?: Record<string, PartialOutputToolCall | undefined>;
  evaluations?: EvaluationChunk[];
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
    evaluationChunk: EvaluationChunk;
  }) => void;
  addRunAnnotations: (annotations: ExperimentRunAnnotation[]) => void;
  addRunCosts: (costs: ExperimentRunCost[]) => void;
  setExampleDataForInstance: (args: {
    data: InstanceResponses;
    instanceId: InstanceId;
  }) => void;
  resetData: () => void;
  setRepetitions: (repetitions: number) => void;
  setExpandedCell: (args: {
    instanceId: InstanceId;
    exampleId: ExampleId;
    repetitionNumber: RepetitionNumber;
    isExpanded: boolean;
  }) => void;
};

type PlaygroundDatasetExamplesTableState = {
  exampleResponsesMap: InstanceToExampleResponsesMap;
  runAnnotationAggregateMetrics: Record<
    InstanceId,
    Record<AnnotationName, ExperimentRunAnnotationAggregateMetric>
  >;
  runCostAggregateMetrics: Record<InstanceId, ExperimentRunCostAggregateMetric>;
  repetitions: number;
  expandedCells: Record<string, boolean>;
} & PlaygroundDatasetExamplesTableActions;

export const makeExpandedCellKey = (
  instanceId: InstanceId,
  exampleId: ExampleId,
  repetitionNumber: RepetitionNumber
) => `${instanceId}-${exampleId}-${repetitionNumber}`;

const createPlaygroundDatasetExamplesTableStore = () => {
  const playgroundDatasetExamplesTableStore: StateCreator<
    PlaygroundDatasetExamplesTableState
  > = (set, get) => ({
    exampleResponsesMap: {},
    runAnnotationAggregateMetrics: {},
    runCostAggregateMetrics: {},
    repetitions: 1,
    expandedCells: {},
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
    addRunAnnotations: (annotations) => {
      if (annotations.length === 0) return;
      const { runAnnotationAggregateMetrics } = get();
      const newrunAnnotationAggregateMetrics = {
        ...runAnnotationAggregateMetrics,
      };
      for (const { instanceId, annotationName, score } of annotations) {
        if (score == null) continue;
        const instanceAggregates =
          newrunAnnotationAggregateMetrics[instanceId] ?? {};
        const prev = instanceAggregates[annotationName] ?? {
          sum: 0,
          count: 0,
        };
        const newSum = prev.sum + score;
        const newCount = prev.count + 1;
        newrunAnnotationAggregateMetrics[instanceId] = {
          ...instanceAggregates,
          [annotationName]: {
            sum: newSum,
            count: newCount,
          },
        };
      }
      set({ runAnnotationAggregateMetrics: newrunAnnotationAggregateMetrics });
    },
    addRunCosts: (costs) => {
      if (costs.length === 0) return;
      const { runCostAggregateMetrics } = get();
      const newAggregates = { ...runCostAggregateMetrics };
      for (const { instanceId, latencyMs, tokenCountTotal, cost } of costs) {
        const prev = newAggregates[instanceId] ?? {
          runCount: 0,
          latencySum: 0,
          latencyCount: 0,
          tokenCountSum: 0,
          tokenCountCount: 0,
          costSum: 0,
          costCount: 0,
        };
        newAggregates[instanceId] = {
          runCount: prev.runCount + 1,
          latencySum:
            latencyMs != null ? prev.latencySum + latencyMs : prev.latencySum,
          latencyCount:
            latencyMs != null ? prev.latencyCount + 1 : prev.latencyCount,
          tokenCountSum:
            tokenCountTotal != null
              ? prev.tokenCountSum + tokenCountTotal
              : prev.tokenCountSum,
          tokenCountCount:
            tokenCountTotal != null
              ? prev.tokenCountCount + 1
              : prev.tokenCountCount,
          costSum: cost != null ? prev.costSum + cost : prev.costSum,
          costCount: cost != null ? prev.costCount + 1 : prev.costCount,
        };
      }
      set({ runCostAggregateMetrics: newAggregates });
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
      set({
        exampleResponsesMap: {},
        runAnnotationAggregateMetrics: {},
        runCostAggregateMetrics: {},
        repetitions: 1,
        expandedCells: {},
      });
    },
    setRepetitions: (repetitions: number) => {
      set({ repetitions });
    },
    setExpandedCell: ({
      instanceId,
      exampleId,
      repetitionNumber,
      isExpanded,
    }) => {
      const key = makeExpandedCellKey(instanceId, exampleId, repetitionNumber);
      const expandedCells = get().expandedCells;
      set({
        expandedCells: {
          ...expandedCells,
          [key]: isExpanded,
        },
      });
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
