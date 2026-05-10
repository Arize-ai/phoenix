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
});
