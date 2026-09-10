import { describe, expect, it, vi } from "vitest";

import {
  reviewEvaluatorPlaygroundOperation,
  configureEvaluatorPlaygroundOperation,
} from "@phoenix/agent/uiOperations/operations/evaluatorPlayground";

import {
  createCalibrationContext,
  matchesExpectedOutput,
  getCalibrationAgreement,
  getCalibrationAnnotationName,
  getExpectedOutputIssue,
  getExpectedVerdict,
  haveCompatibleLabels,
  runCalibrationSample,
} from "../calibration";
import {
  getVisibleEvaluatorSlots,
  setVisibleEvaluatorSlots,
} from "../evaluatorSlotTypes";

describe("calibration", () => {
  it("keeps annotations, expected outputs included, out of whole-object evaluator mappings", () => {
    const metadata = {
      customer: "test",
      annotations: {
        quality: [{ label: "pass", annotator_kind: "HUMAN" }],
      },
    };
    const context = createCalibrationContext({
      input: { question: "hello" },
      output: { response: "hello" },
      metadata,
    });
    expect(context.reference).toEqual({});
    expect(context.output).toEqual({ response: "hello" });
    expect(context.metadata).toEqual({ customer: "test" });
    expect(metadata).toHaveProperty("annotations");
  });
  it("flags expected outputs the selected output config can no longer produce", () => {
    const categorical = {
      name: "quality",
      labels: ["pass", "fail"],
      labelScores: { pass: 1, fail: 0 },
      lowerBound: null,
      upperBound: null,
    };
    const continuous = {
      name: "score",
      labels: [],
      labelScores: {},
      lowerBound: 0,
      upperBound: 1,
    };
    expect(
      getExpectedOutputIssue({
        expected: { label: "pass" },
        output: categorical,
      })
    ).toBeNull();
    expect(
      getExpectedOutputIssue({
        expected: { label: "good" },
        output: categorical,
      })
    ).toMatch(/not one of this output's labels/);
    expect(
      getExpectedOutputIssue({
        expected: { label: null, score: 1.5 },
        output: continuous,
      })
    ).toMatch(/above/);
    expect(
      getExpectedOutputIssue({
        expected: { label: null, score: 0.5 },
        output: continuous,
      })
    ).toBeNull();
    // Without a config to check against there is nothing to flag.
    expect(
      getExpectedOutputIssue({ expected: { label: "good" }, output: undefined })
    ).toBeNull();
    const prediction = {
      status: "success" as const,
      label: "pass",
      score: 1,
      explanation: null,
    };
    expect(
      getExpectedVerdict({
        prediction,
        expected: { label: "good" },
        output: categorical,
      })
    ).toBe("invalid");
    expect(
      getExpectedVerdict({
        prediction,
        expected: { label: "fail" },
        output: categorical,
      })
    ).toBe("mismatch");
    expect(
      getExpectedVerdict({
        prediction,
        expected: { label: "pass" },
        output: categorical,
      })
    ).toBe("match");
    expect(
      getExpectedVerdict({
        prediction: undefined,
        expected: { label: "pass" },
        output: categorical,
      })
    ).toBeNull();
  });
  it("matches server annotation names for single and multiple outputs", () => {
    expect(
      getCalibrationAnnotationName({
        evaluatorName: "judge",
        outputName: "quality",
        outputCount: 1,
      })
    ).toBe("judge");
    expect(
      getCalibrationAnnotationName({
        evaluatorName: "judge",
        outputName: "quality",
        outputCount: 2,
      })
    ).toBe("judge.quality");
  });
  it("counts errors and missing predictions as non-agreements, not successful rows", () => {
    expect(
      getCalibrationAgreement({
        expected: { first: "pass", second: "fail", third: "pass" },
        predictions: {
          first: {
            status: "success",
            label: "pass",
            score: 1,
            explanation: null,
          },
          second: { status: "error", error: "timeout" },
        },
      })
    ).toEqual({ matches: 1, total: 3, percent: 33 });
    expect(
      getCalibrationAgreement({ expected: {}, predictions: {} }).percent
    ).toBeNull();
  });
  it("compares label sets independently of order and rejects unsupported schemas", () => {
    expect(haveCompatibleLabels(["yes", "no"], ["no", "yes"])).toBe(true);
    expect(haveCompatibleLabels(["yes", "no"], ["pass", "fail"])).toBe(false);
    expect(haveCompatibleLabels([], [])).toBe(false);
  });
  it("limits concurrency and associates out-of-order results with their examples", async () => {
    let active = 0;
    let peak = 0;
    const results = new Map<number, string>();
    await runCalibrationSample({
      items: [1, 2, 3, 4, 5],
      concurrency: 2,
      signal: new AbortController().signal,
      execute: async (item) => {
        active++;
        peak = Math.max(peak, active);
        await Promise.resolve();
        if (item % 2) await Promise.resolve();
        active--;
        return {
          status: "success",
          label: String(item),
          score: null,
          explanation: null,
        };
      },
      onResult: (item, prediction) => {
        if (prediction.status === "success" && prediction.label != null)
          results.set(item, prediction.label);
      },
    });
    expect(peak).toBe(2);
    expect([...results.entries()].sort()).toEqual([
      [1, "1"],
      [2, "2"],
      [3, "3"],
      [4, "4"],
      [5, "5"],
    ]);
  });
  it("stops scheduling and suppresses in-flight completions after cancellation", async () => {
    const controller = new AbortController();
    const onResult = vi.fn();
    const execute = vi.fn(async () => {
      controller.abort();
      return {
        status: "success" as const,
        label: "pass",
        score: null,
        explanation: null,
      };
    });
    await runCalibrationSample({
      items: [1, 2, 3],
      concurrency: 1,
      signal: controller.signal,
      execute,
      onResult,
    });
    expect(execute).toHaveBeenCalledTimes(1);
    expect(onResult).not.toHaveBeenCalled();
  });
  it("preserves successful rows after an individual request fails", async () => {
    const results: string[] = [];
    await runCalibrationSample({
      items: [1, 2],
      signal: new AbortController().signal,
      execute: async (item) => {
        if (item === 1) throw new Error("failed");
        return {
          status: "success",
          label: "pass",
          score: null,
          explanation: null,
        };
      },
      onResult: (_, result) => results.push(result.status),
    });
    expect(results.sort()).toEqual(["error", "success"]);
  });
});

describe("independent expected outputs", () => {
  it("matches labels and scores independently without a baseline", () => {
    const prediction = {
      status: "success" as const,
      label: "pass",
      score: 0.75,
      explanation: null,
    };
    expect(
      matchesExpectedOutput(prediction, { label: null, score: 0.75 })
    ).toBe(true);
    expect(matchesExpectedOutput(prediction, { label: "pass" })).toBe(true);
    expect(matchesExpectedOutput(prediction, { label: "pass", score: 1 })).toBe(
      false
    );
    expect(
      matchesExpectedOutput(
        { status: "error", error: "failed" },
        { label: "pass" }
      )
    ).toBe(false);
  });
  it("restores four peer slots and permits removing A", () => {
    const params = new URLSearchParams("compare=true");
    expect(getVisibleEvaluatorSlots(params)).toEqual(["A", "B"]);
    setVisibleEvaluatorSlots(params, ["A", "B", "C", "D"]);
    expect(getVisibleEvaluatorSlots(params)).toEqual(["A", "B", "C", "D"]);
    setVisibleEvaluatorSlots(params, ["B", "C", "D"]);
    expect(getVisibleEvaluatorSlots(params)).toEqual(["B", "C", "D"]);
    expect(params.has("compare")).toBe(false);
  });
});

it("requires an explicit evaluator for expected-output writes", () => {
  const review = {
    exampleId: "example",
    expectedRevisionId: "revision",
    outputName: "quality",
    label: null,
    score: 0.8,
  };
  expect(
    reviewEvaluatorPlaygroundOperation.inputSchema.safeParse(review).success
  ).toBe(false);
  expect(
    reviewEvaluatorPlaygroundOperation.inputSchema.safeParse({
      ...review,
      slot: "D",
    }).success
  ).toBe(true);
  expect(
    configureEvaluatorPlaygroundOperation.inputSchema.safeParse({
      slots: ["A", "B", "C", "D"],
    }).success
  ).toBe(true);
  expect(
    configureEvaluatorPlaygroundOperation.inputSchema.safeParse({
      slots: ["A", "B", "C", "D", "E"],
    }).success
  ).toBe(false);
});
