import { describe, expect, it } from "vitest";

import type { ExperimentMetricsDatum } from "../ExperimentMetrics";
import { mergeExperimentsWithBaseline } from "../ExperimentMetrics";

function makeExperiment({
  id,
  sequenceNumber,
  isBaseline = false,
}: {
  id: string;
  sequenceNumber: number;
  isBaseline?: boolean;
}): ExperimentMetricsDatum {
  return {
    id,
    name: `experiment-${sequenceNumber}`,
    sequenceNumber,
    isBaseline,
    averageRunLatencyMs: null,
    errorRate: null,
    runCount: 0,
    annotationSummaries: [],
    promptCost: null,
    completionCost: null,
    totalCost: null,
    promptTokens: null,
    completionTokens: null,
    totalTokens: null,
  };
}

describe("mergeExperimentsWithBaseline", () => {
  it("returns the windowed experiments when no baseline is set", () => {
    const windowed = [
      makeExperiment({ id: "experiment-1", sequenceNumber: 1 }),
      makeExperiment({ id: "experiment-2", sequenceNumber: 2 }),
    ];

    expect(mergeExperimentsWithBaseline(windowed, null)).toEqual({
      experiments: windowed,
      isBaselineOutOfWindow: false,
    });
  });

  it("does not duplicate a baseline already in the window", () => {
    const baseline = makeExperiment({
      id: "experiment-2",
      sequenceNumber: 2,
      isBaseline: true,
    });
    const windowed = [
      makeExperiment({ id: "experiment-1", sequenceNumber: 1 }),
      baseline,
      makeExperiment({ id: "experiment-3", sequenceNumber: 3 }),
    ];

    expect(mergeExperimentsWithBaseline(windowed, baseline)).toEqual({
      experiments: windowed,
      isBaselineOutOfWindow: false,
    });
  });

  it("prepends a baseline outside the window", () => {
    const baseline = makeExperiment({
      id: "experiment-2",
      sequenceNumber: 2,
      isBaseline: true,
    });
    const windowed = [
      makeExperiment({ id: "experiment-4", sequenceNumber: 4 }),
      makeExperiment({ id: "experiment-5", sequenceNumber: 5 }),
    ];

    expect(mergeExperimentsWithBaseline(windowed, baseline)).toEqual({
      experiments: [baseline, ...windowed],
      isBaselineOutOfWindow: true,
    });
  });

  it("handles a baseline as the only experiment", () => {
    const baseline = makeExperiment({
      id: "experiment-1",
      sequenceNumber: 1,
      isBaseline: true,
    });

    expect(mergeExperimentsWithBaseline([baseline], baseline)).toEqual({
      experiments: [baseline],
      isBaselineOutOfWindow: false,
    });
  });
});
