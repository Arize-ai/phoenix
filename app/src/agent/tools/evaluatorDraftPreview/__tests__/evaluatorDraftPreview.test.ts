import { describe, expect, it } from "vitest";

import { createTestCodeEvaluatorDraftClientAction } from "@phoenix/agent/tools/codeEvaluatorDraft";
import {
  evaluatorDraftPreviewInputSchema,
  MAX_EVALUATOR_PREVIEW_CASES,
  runEvaluatorDraftPreviewClientAction,
  runEvaluatorPreviewCases,
  type EvaluatorPreviewCase,
} from "@phoenix/agent/tools/evaluatorDraftPreview";
import { createTestLlmEvaluatorDraftClientAction } from "@phoenix/agent/tools/llmEvaluatorDraft";

function makeCase(id: string): EvaluatorPreviewCase {
  return {
    id,
    testPayload: {
      input: { id },
      output: {},
      reference: {},
      metadata: {},
    },
  };
}

describe("evaluator draft preview input", () => {
  it("keeps empty input backward compatible", () => {
    expect(evaluatorDraftPreviewInputSchema.parse({})).toEqual({});
    expect(evaluatorDraftPreviewInputSchema.parse(null)).toEqual({});
  });

  it("normalizes one named case and mapping-source aliases", () => {
    expect(
      evaluatorDraftPreviewInputSchema.parse({
        cases: [
          {
            id: " match ",
            test_payload: {
              inputs: { question: "q" },
              outputs: { answer: "a" },
            },
          },
        ],
      })
    ).toEqual({
      cases: [
        {
          id: "match",
          testPayload: {
            input: { question: "q" },
            output: { answer: "a" },
            reference: {},
            metadata: {},
          },
        },
      ],
    });
  });

  it("rejects duplicate or blank IDs, malformed payloads, and oversized batches", () => {
    expect(() =>
      evaluatorDraftPreviewInputSchema.parse({
        cases: [makeCase("same"), makeCase("same")],
      })
    ).toThrow(/duplicate preview case id/i);
    expect(() =>
      evaluatorDraftPreviewInputSchema.parse({
        cases: [{ id: " ", testPayload: {} }],
      })
    ).toThrow();
    expect(() =>
      evaluatorDraftPreviewInputSchema.parse({
        cases: [{ id: "bad", testPayload: { input: "not-an-object" } }],
      })
    ).toThrow();
    expect(() =>
      evaluatorDraftPreviewInputSchema.parse({
        cases: Array.from(
          { length: MAX_EVALUATOR_PREVIEW_CASES + 1 },
          (_, index) => makeCase(String(index))
        ),
      })
    ).toThrow();
  });
});

describe("evaluator draft preview execution", () => {
  it("preserves legacy output for an empty-input call", async () => {
    const output = { results: [{ annotation: { label: "pass" } }] };
    const result = await runEvaluatorDraftPreviewClientAction({
      input: {},
      createPreviewRunner: () => ({
        ok: true,
        output: async (payload) => {
          expect(payload).toBeUndefined();
          return { ok: true, output };
        },
      }),
      concurrency: 1,
    });
    expect(result).toEqual({
      ok: true,
      output: JSON.stringify(output, null, 2),
    });
  });

  it("returns ordered independently recoverable results with aggregate counts", async () => {
    const cases = [makeCase("slow"), makeCase("error"), makeCase("fast")];
    const result = await runEvaluatorPreviewCases({
      cases,
      concurrency: 2,
      getNow: () => 100,
      runPreview: async (payload) => {
        const id = payload?.input.id;
        if (id === "slow") {
          await Promise.resolve();
        }
        return id === "error"
          ? { ok: false, error: "provider failed" }
          : { ok: true, output: { label: id } };
      },
    });
    expect(result).toEqual({
      summary: { total: 3, succeeded: 2, failed: 1 },
      cases: [
        { id: "slow", result: { label: "slow" }, latencyMs: 0 },
        { id: "error", error: "provider failed", latencyMs: 0 },
        { id: "fast", result: { label: "fast" }, latencyMs: 0 },
      ],
    });
  });

  it("bounds concurrency and does not mutate case payloads", async () => {
    const cases = [makeCase("one"), makeCase("two"), makeCase("three")];
    const before = structuredClone(cases);
    let active = 0;
    let maximumActive = 0;
    await runEvaluatorPreviewCases({
      cases,
      concurrency: 2,
      runPreview: async () => {
        active += 1;
        maximumActive = Math.max(maximumActive, active);
        await Promise.resolve();
        active -= 1;
        return { ok: true, output: {} };
      },
    });
    expect(maximumActive).toBe(2);
    expect(cases).toEqual(before);
  });

  it("refills a freed concurrency slot immediately instead of waiting for the whole wave", async () => {
    // "slow" and "fast-1" occupy the two concurrency slots first. A
    // fixed-size-wave implementation only starts "fast-2" once the whole
    // wave (both "slow" and "fast-1") settles -- i.e. only after the slow
    // case is released. A worker pool starts "fast-2" as soon as "fast-1"'s
    // slot frees up, well before the slow case is released.
    const cases = [makeCase("slow"), makeCase("fast-1"), makeCase("fast-2")];
    let slowReleased = false;
    let fastTwoStartedBeforeSlowReleased = false;
    let releaseSlow: () => void = () => {};
    const slowGate = new Promise<void>((resolve) => {
      releaseSlow = resolve;
    });
    const runPromise = runEvaluatorPreviewCases({
      cases,
      concurrency: 2,
      runPreview: async (payload) => {
        const id = payload?.input.id as string;
        if (id === "slow") {
          await slowGate;
        } else if (id === "fast-2" && !slowReleased) {
          fastTwoStartedBeforeSlowReleased = true;
        }
        return { ok: true, output: { label: id } };
      },
    });
    // Give "fast-1" (and, with a true worker pool, "fast-2") room to run
    // before releasing the slow case.
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    slowReleased = true;
    releaseSlow();
    await runPromise;
    expect(fastTwoStartedBeforeSlowReleased).toBe(true);
  });

  it("promotes an evaluator result error to an isolated case error", async () => {
    const result = await runEvaluatorPreviewCases({
      cases: [makeCase("provider-error"), makeCase("success")],
      concurrency: 2,
      getNow: () => 0,
      runPreview: async (payload) =>
        payload?.input.id === "provider-error"
          ? {
              ok: true,
              output: {
                results: [{ evaluatorName: "judge", error: "rate limited" }],
              },
            }
          : {
              ok: true,
              output: { results: [{ annotation: { label: "pass" } }] },
            },
    });
    expect(result.summary).toEqual({ total: 2, succeeded: 1, failed: 1 });
    expect(result.cases[0]).toEqual({
      id: "provider-error",
      error: "rate limited",
      latencyMs: 0,
      result: {
        results: [{ evaluatorName: "judge", error: "rate limited" }],
      },
    });
    expect(result.cases[1]).toMatchObject({ id: "success" });
  });

  it("preserves successful output configs when a sibling output config errors on the same case", async () => {
    const mixedOutput = {
      results: [
        { evaluatorName: "correctness", annotation: { label: "pass" } },
        { evaluatorName: "safety", error: "missing credentials" },
      ],
    };
    const result = await runEvaluatorPreviewCases({
      cases: [makeCase("mixed")],
      concurrency: 1,
      getNow: () => 0,
      runPreview: async () => ({ ok: true, output: mixedOutput }),
    });
    expect(result.summary).toEqual({ total: 1, succeeded: 0, failed: 1 });
    // The case is still classified as failed (one config errored), but the
    // successful "correctness" annotation must survive on `result` instead
    // of being discarded in favor of only the error string.
    expect(result.cases[0]).toEqual({
      id: "mixed",
      error: "missing credentials",
      latencyMs: 0,
      result: mixedOutput,
    });
  });

  it("fails the whole call when the mounted draft cannot produce a snapshot", async () => {
    const result = await runEvaluatorDraftPreviewClientAction({
      input: { cases: [makeCase("one")] },
      createPreviewRunner: () => ({
        ok: false,
        error: "Draft has no output configuration",
      }),
      concurrency: 1,
    });
    expect(result).toEqual({
      ok: false,
      error: "Draft has no output configuration",
    });
  });

  it("reports ok:false when every case in a batch fails", async () => {
    const result = await runEvaluatorDraftPreviewClientAction({
      input: { cases: [makeCase("one"), makeCase("two")] },
      createPreviewRunner: () => ({
        ok: true,
        output: async () => ({ ok: false, error: "sandbox unreachable" }),
      }),
      concurrency: 2,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/all 2 preview case\(s\) failed/i);
    expect(result.error).toMatch(/sandbox unreachable/);
  });

  it("still reports ok:true when only some cases in a batch fail", async () => {
    const result = await runEvaluatorDraftPreviewClientAction({
      input: { cases: [makeCase("ok"), makeCase("bad")] },
      createPreviewRunner: () => ({
        ok: true,
        output: async (payload) =>
          payload?.input.id === "bad"
            ? { ok: false, error: "provider failed" }
            : { ok: true, output: { label: "pass" } },
      }),
      concurrency: 2,
    });
    expect(result.ok).toBe(true);
  });

  it("only updates the form's own preview UI for the legacy single-payload path", async () => {
    const shouldUpdateUiByCall: Array<boolean | undefined> = [];
    const createPreviewRunner: Parameters<
      typeof runEvaluatorDraftPreviewClientAction
    >[0]["createPreviewRunner"] = (options) => {
      shouldUpdateUiByCall.push(options?.shouldUpdateUi);
      return {
        ok: true,
        output: async () => ({ ok: true, output: {} }),
      };
    };
    await runEvaluatorDraftPreviewClientAction({
      input: {},
      createPreviewRunner,
      concurrency: 1,
    });
    await runEvaluatorDraftPreviewClientAction({
      input: { cases: [makeCase("one")] },
      createPreviewRunner,
      concurrency: 1,
    });
    expect(shouldUpdateUiByCall).toEqual([true, false]);
  });

  it("returns equivalent code and LLM batch envelopes", async () => {
    const input = { cases: [makeCase("one"), makeCase("two")] };
    const createPreviewRunner = () => ({
      ok: true as const,
      output: async () => ({ ok: true as const, output: { label: "pass" } }),
    });
    const codeAction = createTestCodeEvaluatorDraftClientAction({
      isDraftMounted: () => true,
      createPreviewRunner,
    });
    const llmAction = createTestLlmEvaluatorDraftClientAction({
      isDraftMounted: () => true,
      createPreviewRunner,
    });
    const [codeResult, llmResult] = await Promise.all([
      codeAction(input),
      llmAction(input),
    ]);
    expect(codeResult.ok).toBe(true);
    expect(llmResult.ok).toBe(true);
    if (!codeResult.ok || !llmResult.ok) return;
    const codeOutput = JSON.parse(codeResult.output ?? "") as {
      summary: unknown;
      cases: Array<Record<string, unknown>>;
    };
    const llmOutput = JSON.parse(llmResult.output ?? "") as typeof codeOutput;
    expect(llmOutput.summary).toEqual(codeOutput.summary);
    expect(
      llmOutput.cases.map(({ latencyMs: _, ...result }) => result)
    ).toEqual(codeOutput.cases.map(({ latencyMs: _, ...result }) => result));
  });

  it("returns actionable duplicate-ID errors from both tools", async () => {
    const invalidInput = {
      cases: [makeCase("duplicate"), makeCase("duplicate")],
    };
    const createPreviewRunner = () => ({
      ok: true as const,
      output: async () => ({ ok: true as const, output: {} }),
    });
    const actions = [
      createTestCodeEvaluatorDraftClientAction({
        isDraftMounted: () => true,
        createPreviewRunner,
      }),
      createTestLlmEvaluatorDraftClientAction({
        isDraftMounted: () => true,
        createPreviewRunner,
      }),
    ];
    for (const action of actions) {
      const result = await action(invalidInput);
      expect(result.ok).toBe(false);
      if (result.ok) continue;
      expect(result.error).toMatch(/duplicate preview case id: duplicate/i);
    }
  });
});
