import { describe, expect, it } from "vitest";

import {
  createPlaygroundDatasetExamplesTableStore,
  type EvaluationChunk,
  type ExampleRunData,
} from "../PlaygroundDatasetExamplesTableContext";

type RunFigures = {
  latencyMs: number | null;
  tokenCountTotal: number | null;
  cost: number | null;
};

function span(figures: RunFigures): NonNullable<ExampleRunData["span"]> {
  return {
    id: "span-1",
    tokenCountTotal: figures.tokenCountTotal,
    costSummary: { total: { cost: figures.cost } },
    latencyMs: figures.latencyMs,
    project: { id: "project-1" },
    context: { traceId: "trace-1" },
  };
}

function evaluation(exampleId: string, score: number | null): EvaluationChunk {
  return {
    __typename: "EvaluationChunk",
    experimentId: "experiment-1",
    datasetExampleId: exampleId,
    repetitionNumber: 1,
    evaluatorName: "judge",
    experimentRunEvaluation:
      score == null
        ? null
        : {
            id: `annotation-${exampleId}`,
            name: "judge",
            label: null,
            score,
            annotatorKind: "CODE",
            explanation: null,
            metadata: {},
            startTime: "2026-09-15T00:00:00Z",
          },
    trace: null,
    error: null,
  };
}

/** Records one finished run for `exampleId` the way the table's event handlers do. */
function recordRun(
  store: ReturnType<typeof createPlaygroundDatasetExamplesTableStore>,
  exampleId: string,
  figures: RunFigures,
  score: number | null
) {
  const state = store.getState();
  state.updateExampleData({
    instanceId: 1,
    exampleId,
    repetitionNumber: 1,
    patch: { span: span(figures) },
  });
  state.addRunCosts([{ instanceId: 1, ...figures }]);
  state.appendExampleDataEvaluationChunk({
    instanceId: 1,
    exampleId,
    repetitionNumber: 1,
    evaluationChunk: evaluation(exampleId, score),
  });
  state.addRunAnnotations([{ instanceId: 1, annotationName: "judge", score }]);
}

describe("resetExampleData", () => {
  it("forgets one example's runs and takes their share out of the aggregates", () => {
    const store = createPlaygroundDatasetExamplesTableStore();
    recordRun(store, "a", { latencyMs: 100, tokenCountTotal: 10, cost: 1 }, 1);
    recordRun(store, "b", { latencyMs: 300, tokenCountTotal: 30, cost: 3 }, 0);
    store.getState().setExpandedCell({
      instanceId: 1,
      exampleId: "a",
      repetitionNumber: 1,
      isExpanded: true,
    });

    store.getState().resetExampleData({ instanceIds: [1], exampleIds: ["a"] });

    const next = store.getState();
    expect(Object.keys(next.exampleResponsesMap[1] ?? {})).toEqual(["b"]);
    expect(next.runCostAggregateMetrics[1]).toEqual({
      runCount: 1,
      latencySum: 300,
      latencyCount: 1,
      tokenCountSum: 30,
      tokenCountCount: 1,
      costSum: 3,
      costCount: 1,
    });
    expect(next.runAnnotationAggregateMetrics[1]).toEqual({
      judge: { sum: 0, count: 1 },
    });
    expect(next.expandedCells).toEqual({});
  });

  it("leaves runs without figures or scores out of the subtraction", () => {
    const store = createPlaygroundDatasetExamplesTableStore();
    recordRun(
      store,
      "a",
      { latencyMs: 100, tokenCountTotal: null, cost: null },
      null
    );
    recordRun(store, "b", { latencyMs: 200, tokenCountTotal: 20, cost: 2 }, 1);

    store.getState().resetExampleData({ instanceIds: [1], exampleIds: ["a"] });

    const next = store.getState();
    expect(next.runCostAggregateMetrics[1]).toEqual({
      runCount: 1,
      latencySum: 200,
      latencyCount: 1,
      tokenCountSum: 20,
      tokenCountCount: 1,
      costSum: 2,
      costCount: 1,
    });
    expect(next.runAnnotationAggregateMetrics[1]).toEqual({
      judge: { sum: 1, count: 1 },
    });
  });

  it("ignores instances and examples it has nothing for", () => {
    const store = createPlaygroundDatasetExamplesTableStore();
    recordRun(store, "a", { latencyMs: 100, tokenCountTotal: 10, cost: 1 }, 1);

    store
      .getState()
      .resetExampleData({ instanceIds: [1, 2], exampleIds: ["missing"] });

    const next = store.getState();
    expect(Object.keys(next.exampleResponsesMap[1] ?? {})).toEqual(["a"]);
    expect(next.runCostAggregateMetrics[1]?.runCount).toBe(1);
    expect(next.runAnnotationAggregateMetrics[1]).toEqual({
      judge: { sum: 1, count: 1 },
    });
  });
});
