import { describe, expect, it } from "vitest";

import { getPlaygroundCompareLaneLiveRuns } from "../playgroundCompareLaneLiveRuns";

describe("getPlaygroundCompareLaneLiveRuns", () => {
  it("lists every repetition as pending when a run has just started", () => {
    expect(
      getPlaygroundCompareLaneLiveRuns({
        repetitionCount: 2,
        isRunning: true,
      }).pendingRuns
    ).toEqual([
      { repetitionNumber: 1, partialOutput: null },
      { repetitionNumber: 2, partialOutput: null },
    ]);
  });

  it("carries the text streamed so far for a repetition that is still pending", () => {
    expect(
      getPlaygroundCompareLaneLiveRuns({
        responsesByRepetitionNumber: { 1: { content: "The capital" } },
        repetitionCount: 1,
        isRunning: true,
      }).pendingRuns
    ).toEqual([{ repetitionNumber: 1, partialOutput: "The capital" }]);
  });

  it("stops listing a repetition once its run is recorded or has failed", () => {
    expect(
      getPlaygroundCompareLaneLiveRuns({
        responsesByRepetitionNumber: {
          1: { content: "Paris", experimentRunId: "run-1" },
          2: { errorMessage: "rate limited" },
          3: { content: "Par" },
        },
        repetitionCount: 3,
        isRunning: true,
      }).pendingRuns.map((run) => run.repetitionNumber)
    ).toEqual([3]);
  });

  it("has no pending runs when the instance is not running the example", () => {
    expect(
      getPlaygroundCompareLaneLiveRuns({
        repetitionCount: 2,
        isRunning: false,
      }).pendingRuns
    ).toEqual([]);
  });

  it("changes its fetch key when a run or an evaluation is recorded, not when text streams", () => {
    const getFetchKey = (
      responsesByRepetitionNumber: Parameters<
        typeof getPlaygroundCompareLaneLiveRuns
      >[0]["responsesByRepetitionNumber"]
    ) =>
      getPlaygroundCompareLaneLiveRuns({
        responsesByRepetitionNumber,
        repetitionCount: 1,
        isRunning: true,
      }).fetchKey;
    const streamingKey = getFetchKey({ 1: { content: "Par" } });
    const recordedKey = getFetchKey({
      1: { content: "Paris", experimentRunId: "run-1" },
    });
    const evaluatedKey = getFetchKey({
      1: {
        content: "Paris",
        experimentRunId: "run-1",
        evaluations: [
          {
            __typename: "EvaluationChunk",
            experimentId: "experiment-1",
            datasetExampleId: "example-1",
            repetitionNumber: 1,
            evaluatorName: "judge",
            experimentRunEvaluation: null,
            trace: null,
            error: "boom",
          },
        ],
      },
    });
    expect(getFetchKey({ 1: { content: "P" } })).toBe(streamingKey);
    expect(recordedKey).not.toBe(streamingKey);
    expect(evaluatedKey).not.toBe(recordedKey);
  });
});
