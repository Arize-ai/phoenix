/**
 * End-to-end test of the runner driving Vitest's own describe/test.
 *
 * `PHOENIX_TEST_TRACKING=false` is set globally so no network calls are made
 * to a Phoenix server. We assert that the public API records the run's
 * output, annotations, and evaluator results into the suite registry.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { getAllSuites } from "../../src/testing/runner";
import {
  evaluate,
  logAnnotation,
  recordOutput,
  traceEvaluator,
  describe as pxDescribe,
  test as pxTest,
} from "../../src/vitest";

const originalTracking = process.env.PHOENIX_TEST_TRACKING;

// Capture console.warn so we can assert on the "evaluate before recordOutput"
// warning emitted from a wrapped test body during the run phase.
/* eslint-disable no-console */
const warnings: string[] = [];
const originalWarn = console.warn;
console.warn = (...args: unknown[]) => {
  warnings.push(args.map(String).join(" "));
};
/* eslint-enable no-console */

beforeAll(() => {
  process.env.PHOENIX_TEST_TRACKING = "false";
});
afterAll(() => {
  // eslint-disable-next-line no-console
  console.warn = originalWarn;
  if (originalTracking === undefined) {
    delete process.env.PHOENIX_TEST_TRACKING;
  } else {
    process.env.PHOENIX_TEST_TRACKING = originalTracking;
  }
});

pxDescribe("phoenix client test selftest", () => {
  pxTest(
    "captures output and annotations",
    {
      input: { name: "selftest" },
      expected: { greeting: "hello selftest" },
    },
    async ({ input, expected }) => {
      const greeting = `hello ${input.name}`;
      recordOutput({ greeting });
      logAnnotation({ name: "manual", score: 0.42 });
      await evaluate({
        name: "object_eval",
        kind: "CODE",
        evaluate: ({ output }: { output?: unknown }) => ({
          score:
            typeof output === "object" &&
            output !== null &&
            "greeting" in output
              ? 1
              : 0,
        }),
      });
      const evalFn = traceEvaluator(
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
  "phoenix client test repetitions",
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

pxDescribe("phoenix client test dry run", () => {
  pxTest("tracked case", { input: { kind: "tracked" } }, async () => {
    recordOutput({ ok: true });
  });
  pxTest(
    "local-only case",
    { input: { kind: "local" }, dryRun: true },
    async () => {
      recordOutput({ ok: true });
    }
  );
});

pxDescribe(
  "phoenix client test acceptance",
  () => {
    pxTest("strong case", { input: { n: 1 } }, async () => {
      logAnnotation({ name: "quality", score: 1 });
    });
    pxTest("weak case", { input: { n: 2 } }, async () => {
      logAnnotation({ name: "quality", score: 0.8 });
    });
  },
  {
    acceptanceCriteria: [
      { annotationName: "quality", metric: "average", threshold: 0.9 },
    ],
  }
);

const eachRows = [
  { input: { q: "a" }, expected: { label: "x" }, splits: ["group-1"] },
  { input: { q: "b" }, expected: { label: "y" }, splits: ["group-2"] },
];
pxDescribe("phoenix client test each", () => {
  pxTest.each(eachRows)(
    (row, i) => `case ${i}: ${row.input.q}`,
    async () => {}
  );
});

pxDescribe("phoenix client test missing output", () => {
  pxTest(
    "evaluate without recordOutput warns once",
    { input: { n: 1 } },
    async () => {
      // No recordOutput() — the evaluator receives output=undefined.
      await evaluate({
        name: "needs_output",
        evaluate: ({ output }: { output?: unknown }) => ({
          score: output ? 1 : 0,
        }),
      });
      // A second evaluate in the same suite must not warn again.
      await evaluate({
        name: "needs_output_again",
        evaluate: ({ output }: { output?: unknown }) => ({
          score: output ? 1 : 0,
        }),
      });
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
    const suite = suites.find((s) => s.name === "phoenix client test selftest");
    expect(
      suite,
      "phoenix client test selftest suite is registered"
    ).toBeDefined();
    const captured = suite!.results.find(
      (r) => r.testName === "captures output and annotations"
    );
    expect(captured, "captures output test result is recorded").toBeDefined();
    expect(captured!.status).toBe("passed");
    expect(captured!.output).toEqual({ greeting: "hello selftest" });
    const annotationNames = captured!.annotations.map((a) => a.name).sort();
    expect(annotationNames).toEqual([
      "exact_match",
      "manual",
      "object_eval",
      "pass",
    ]);
    expect(captured!.annotations).toContainEqual(
      expect.objectContaining({
        name: "object_eval",
        score: 1,
      })
    );
  });

  it("expands repetitions per-test and from suite config", async () => {
    await new Promise((resolve) => setImmediate(resolve));
    const suite = getAllSuites().find(
      (s) => s.name === "phoenix client test repetitions"
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
    const suite = getAllSuites().find(
      (s) => s.name === "phoenix client test dry run"
    );
    expect(suite).toBeDefined();
    expect([...suite!.registeredExamples.keys()]).toEqual(["tracked case"]);
    const local = suite!.results.find((r) => r.testName === "local-only case");
    expect(local?.dryRun).toBe(true);
    expect(local?.status).toBe("passed");
  });

  it("test.each accepts a name function and forwards splits", async () => {
    await new Promise((resolve) => setImmediate(resolve));
    const suite = getAllSuites().find(
      (s) => s.name === "phoenix client test each"
    );
    expect(suite).toBeDefined();
    expect([...suite!.registeredExamples.keys()]).toEqual([
      "case 0: a",
      "case 1: b",
    ]);
    const splits = [...suite!.registeredExamples.values()].map(
      (e) => e.params.splits
    );
    expect(splits).toEqual([["group-1"], ["group-2"]]);
  });

  it("warns once per suite when evaluate runs before recordOutput", async () => {
    await new Promise((resolve) => setImmediate(resolve));
    const outputWarnings = warnings.filter(
      (w) => w.includes("ran before") && w.includes("recordOutput()")
    );
    expect(outputWarnings).toHaveLength(1);
    expect(outputWarnings[0]).toContain("needs_output");
  });

  it("records passing acceptance results after a suite completes", async () => {
    await new Promise((resolve) => setImmediate(resolve));
    const suite = getAllSuites().find(
      (s) => s.name === "phoenix client test acceptance"
    );
    expect(suite).toBeDefined();
    expect(suite!.acceptanceResults).toHaveLength(1);
    expect(suite!.acceptanceResults?.[0]).toMatchObject({
      annotationName: "quality",
      metric: "average",
      threshold: 0.9,
      value: 0.9,
      sampleCount: 2,
      passed: true,
    });
  });
});
