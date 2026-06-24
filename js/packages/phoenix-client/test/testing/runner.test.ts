/**
 * End-to-end test of the runner driving Vitest's own describe/test.
 *
 * `PHOENIX_TEST_TRACING=false` is set globally so no network calls are made
 * to a Phoenix server. We assert that the public API records the run's
 * output, annotations, and evaluator results into the suite registry.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { getAllSuites } from "../../src/testing/runner";
import {
  evaluate,
  logAnnotation,
  logOutput,
  traceEvaluator,
  describe as pxDescribe,
  test as pxTest,
} from "../../src/vitest";

const originalTracking = process.env.PHOENIX_TEST_TRACING;

// Capture console.warn so we can assert on the "evaluate before logOutput"
// warning emitted from a wrapped test body during the run phase.
/* eslint-disable no-console */
const warnings: string[] = [];
const originalWarn = console.warn;
console.warn = (...args: unknown[]) => {
  warnings.push(args.map(String).join(" "));
};
/* eslint-enable no-console */

beforeAll(() => {
  process.env.PHOENIX_TEST_TRACING = "false";
});
afterAll(() => {
  // eslint-disable-next-line no-console
  console.warn = originalWarn;
  if (originalTracking === undefined) {
    delete process.env.PHOENIX_TEST_TRACING;
  } else {
    process.env.PHOENIX_TEST_TRACING = originalTracking;
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
      logOutput({ greeting });
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

// Row-level `repetitions` and `dryRun` must be forwarded onto each declared
// test, just like the equivalent fields on `test()`.
const controlRows = [
  { input: { q: "tracked" }, repetitions: 3 },
  { input: { q: "local" }, dryRun: true },
];
pxDescribe("phoenix client test each controls", () => {
  pxTest.each(controlRows)(
    (row) => `control ${row.input.q}`,
    async () => {}
  );
});

// test.each rows accept the reference output under any alias, just like test().
const aliasRows = [
  { input: { q: "a" }, expected: { label: "ex" } },
  { input: { q: "b" }, reference: { label: "ref" } },
  { input: { q: "c" }, output: { label: "out" } },
];
pxDescribe("phoenix client test each aliases", () => {
  pxTest.each(aliasRows)(
    (row) => `each ${row.input.q}`,
    async () => {}
  );
});

// The reference output may be supplied under any of three interchangeable
// keys; all normalize to the same `expected` slot the test body receives.
const seenExpected: Record<string, unknown> = {};
pxDescribe("phoenix client test reference aliases", () => {
  pxTest(
    "via expected",
    { input: { q: "e" }, expected: { label: "from-expected" } },
    async ({ expected }) => {
      seenExpected.expected = expected;
    }
  );
  pxTest(
    "via reference",
    { input: { q: "r" }, reference: { label: "from-reference" } },
    async ({ expected }) => {
      seenExpected.reference = expected;
    }
  );
  pxTest(
    "via output",
    { input: { q: "o" }, output: { label: "from-output" } },
    async ({ expected }) => {
      seenExpected.output = expected;
    }
  );
});

pxDescribe("phoenix client test missing output", () => {
  pxTest(
    "evaluate without logOutput warns once",
    { input: { n: 1 } },
    async () => {
      // No logOutput() — the evaluator receives output=undefined.
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

  it("a skipped test does not register a dataset example", async () => {
    await new Promise((resolve) => setImmediate(resolve));
    const suite = getAllSuites().find(
      (s) => s.name === "phoenix client test selftest"
    );
    expect(suite).toBeDefined();
    // The skipped case must not be uploaded to the tracked dataset.
    expect([...suite!.registeredExamples.keys()]).not.toContain("is skipped");
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

  it("test.each forwards row-level repetitions and dryRun", async () => {
    await new Promise((resolve) => setImmediate(resolve));
    const suite = getAllSuites().find(
      (s) => s.name === "phoenix client test each controls"
    );
    expect(suite).toBeDefined();
    // The `repetitions: 3` row expands to three runs, lifting the suite max.
    expect(suite!.maxRepetitions).toBe(3);
    // The `dryRun: true` row opts out of Phoenix, so it registers no example.
    expect([...suite!.registeredExamples.keys()]).toEqual(["control tracked"]);
    const local = suite!.results.find((r) => r.testName === "control local");
    expect(local?.dryRun).toBe(true);
  });

  it("normalizes expected / reference / output to the same slot", async () => {
    await new Promise((resolve) => setImmediate(resolve));
    // The test body receives each alias under the canonical `expected` arg.
    expect(seenExpected).toEqual({
      expected: { label: "from-expected" },
      reference: { label: "from-reference" },
      output: { label: "from-output" },
    });
    // ...and each is registered as the dataset example's reference output.
    const suite = getAllSuites().find(
      (s) => s.name === "phoenix client test reference aliases"
    );
    expect(suite).toBeDefined();
    const expectedByTest = Object.fromEntries(
      [...suite!.registeredExamples.values()].map((e) => [
        e.testName,
        e.params.expected,
      ])
    );
    expect(expectedByTest).toEqual({
      "via expected": { label: "from-expected" },
      "via reference": { label: "from-reference" },
      "via output": { label: "from-output" },
    });
  });

  it("test.each resolves reference output under any alias", async () => {
    await new Promise((resolve) => setImmediate(resolve));
    const suite = getAllSuites().find(
      (s) => s.name === "phoenix client test each aliases"
    );
    expect(suite).toBeDefined();
    const expectedByTest = Object.fromEntries(
      [...suite!.registeredExamples.values()].map((e) => [
        e.testName,
        e.params.expected,
      ])
    );
    expect(expectedByTest).toEqual({
      "each a": { label: "ex" },
      "each b": { label: "ref" },
      "each c": { label: "out" },
    });
  });

  it("warns once per suite when evaluate runs before logOutput", async () => {
    await new Promise((resolve) => setImmediate(resolve));
    const outputWarnings = warnings.filter(
      (w) => w.includes("ran before") && w.includes("logOutput()")
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
