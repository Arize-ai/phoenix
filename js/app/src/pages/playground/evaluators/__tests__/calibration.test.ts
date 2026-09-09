import { describe, expect, it, vi } from "vitest";

import {
  createCalibrationContext,
  getCalibrationAgreement,
  getCalibrationAnnotationName,
  haveCompatibleLabels,
  runCalibrationSample,
} from "../calibration";

describe("calibration", () => {
  it("keeps expected labels out of whole-object evaluator mappings", () => {
    const metadata = {
      customer: "test",
      phoenix_evaluator_calibration: { labels: { quality: "pass" } },
    };
    const context = createCalibrationContext({
      input: { question: "hello" },
      output: { response: "hello" },
      metadata,
    });
    expect(context.reference).toEqual({});
    expect(context.output).toEqual({ response: "hello" });
    expect(context.metadata).toEqual({ customer: "test" });
    expect(metadata).toHaveProperty("phoenix_evaluator_calibration");
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
        if (prediction.status === "success")
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
