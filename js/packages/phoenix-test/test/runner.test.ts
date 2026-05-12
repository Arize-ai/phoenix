/**
 * End-to-end test of the runner driving Vitest's own describe/test.
 *
 * `PHOENIX_TEST_TRACKING=false` is set globally so no network calls are made
 * to a Phoenix server. We assert that the public API records the run's
 * output, annotations, and `wrapEvaluator` results into the suite registry.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { getAllSuites } from "../src/core/runner";
import {
  logAnnotation,
  logOutput,
  wrapEvaluator,
  describe as pxDescribe,
  test as pxTest,
} from "../src/vitest";

const originalTracking = process.env.PHOENIX_TEST_TRACKING;
beforeAll(() => {
  process.env.PHOENIX_TEST_TRACKING = "false";
});
afterAll(() => {
  if (originalTracking === undefined) {
    delete process.env.PHOENIX_TEST_TRACKING;
  } else {
    process.env.PHOENIX_TEST_TRACKING = originalTracking;
  }
});

pxDescribe("phoenix-test selftest", () => {
  pxTest(
    "captures output and annotations",
    {
      input: { name: "selftest" },
      expected: { greeting: "hello selftest" },
    },
    async ({ input, expected }) => {
      const greeting = `hello ${input.name}`;
      logOutput({ greeting });
      logAnnotation({ name: "manual", score: 0.42 });
      const evalFn = wrapEvaluator(
        async ({ output, expected }: { output: string; expected: string }) => {
          return { name: "exact_match", score: output === expected };
        }
      );
      await evalFn({
        output: greeting,
        expected: expected?.greeting ?? "",
      });
    }
  );

  pxTest.skip("is skipped", { input: { skip: true } }, async () => {
    throw new Error("should not execute");
  });
});

let repCount = 0;
pxDescribe(
  "phoenix-test repetitions",
  () => {
    // suite-level repetitions: 2, overridden to 3 on this test.
    pxTest(
      "runs three times",
      { input: { n: 1 }, repetitions: 3 },
      async () => {
        repCount++;
      }
    );
    pxTest("runs twice from suite", { input: { n: 2 } }, async () => {});
  },
  { repetitions: 2 }
);

pxDescribe("phoenix-test dry run", () => {
  pxTest("tracked case", { input: { kind: "tracked" } }, async () => {
    logOutput({ ok: true });
  });
  pxTest(
    "local-only case",
    { input: { kind: "local" }, dryRun: true },
    async () => {
      logOutput({ ok: true });
    }
  );
});

describe("runner registry", () => {
  it("records suite results after the inner describe completes", async () => {
    // The test above runs in the same file, so by the time this assertion
    // executes Vitest has already invoked our wrapped tests. We assert in an
    // afterAll-style hook by polling the registry.
    await new Promise((resolve) => setImmediate(resolve));
    const suites = getAllSuites();
    const suite = suites.find((s) => s.name === "phoenix-test selftest");
    expect(suite, "phoenix-test selftest suite is registered").toBeDefined();
    const captured = suite!.results.find(
      (r) => r.testName === "captures output and annotations"
    );
    expect(captured, "captures output test result is recorded").toBeDefined();
    expect(captured!.status).toBe("passed");
    expect(captured!.output).toEqual({ greeting: "hello selftest" });
    const annotationNames = captured!.annotations.map((a) => a.name).sort();
    expect(annotationNames).toEqual(["exact_match", "manual", "pass"]);
  });

  it("expands repetitions per-test and from suite config", async () => {
    await new Promise((resolve) => setImmediate(resolve));
    const suite = getAllSuites().find(
      (s) => s.name === "phoenix-test repetitions"
    );
    expect(suite).toBeDefined();
    expect(repCount).toBe(3);
    const threeTimes = suite!.results.filter((r) =>
      r.testName.startsWith("runs three times")
    );
    expect(threeTimes).toHaveLength(3);
    expect(threeTimes.map((r) => r.repetitionNumber).sort()).toEqual([1, 2, 3]);
    expect(threeTimes.every((r) => r.testName.includes("[rep "))).toBe(true);
    const twice = suite!.results.filter((r) =>
      r.testName.startsWith("runs twice from suite")
    );
    expect(twice).toHaveLength(2);
    // Only one logical example is registered per test.
    expect(suite!.registeredExamples.size).toBe(2);
    expect(suite!.maxRepetitions).toBe(3);
  });

  it("a per-test dryRun does not register a dataset example", async () => {
    await new Promise((resolve) => setImmediate(resolve));
    const suite = getAllSuites().find((s) => s.name === "phoenix-test dry run");
    expect(suite).toBeDefined();
    expect([...suite!.registeredExamples.keys()]).toEqual(["tracked case"]);
    const local = suite!.results.find((r) => r.testName === "local-only case");
    expect(local?.dryRun).toBe(true);
    expect(local?.status).toBe("passed");
  });
});
