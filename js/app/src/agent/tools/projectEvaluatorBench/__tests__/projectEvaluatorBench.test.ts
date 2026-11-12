import {
  createReadProjectEvaluatorBenchClientAction,
  createRunProjectEvaluatorBenchClientAction,
  type ProjectEvaluatorBenchHost,
  selectBenchRunEntries,
  summarizeBenchEntry,
  summarizeFinishedRun,
} from "@phoenix/agent/tools/projectEvaluatorBench";
import type {
  FinishedRecordedRun,
  RecordedRunEntry,
  RecordedRunRow,
} from "@phoenix/pages/project/evaluators/projectEvaluatorTestBenchTypes";

function makeRow(recordId: string): RecordedRunRow {
  return {
    key: `node-${recordId}`,
    name: "ChatCompletion",
    recordId,
    snippet: "Where is my order?",
    context: { input: {}, output: {} },
    isSample: false,
  };
}

function makeEntry(
  recordId: string,
  resultState: RecordedRunEntry["resultState"] = { kind: "idle" }
): RecordedRunEntry {
  return {
    row: makeRow(recordId),
    missingCount: resultState.kind === "missing" ? resultState.count : 0,
    run: undefined,
    resultState,
  };
}

const DONE_RUN: FinishedRecordedRun = {
  status: "done",
  fingerprint: "f",
  results: [
    {
      evaluatorName: "helpfulness",
      annotation: {
        name: "helpfulness",
        label: "helpful",
        score: 1,
        explanation: "Answers the question.",
      },
      error: null,
    },
  ],
};

describe("selectBenchRunEntries", () => {
  const entries = [
    makeEntry("a"),
    makeEntry("b", { kind: "missing", count: 1 }),
    makeEntry("c"),
    makeEntry("d"),
    makeEntry("e"),
  ];

  it("takes the most recent runnable records, three by default", () => {
    const selection = selectBenchRunEntries({ entries, input: {} });
    expect(
      selection.ok && selection.entries.map(({ row }) => row.recordId)
    ).toEqual(["a", "c", "d"]);
  });

  it("honours a count", () => {
    const selection = selectBenchRunEntries({ entries, input: { count: 1 } });
    expect(
      selection.ok && selection.entries.map(({ row }) => row.recordId)
    ).toEqual(["a"]);
  });

  it("runs named records in the order given", () => {
    const selection = selectBenchRunEntries({
      entries,
      input: { recordIds: ["e", "a"] },
    });
    expect(
      selection.ok && selection.entries.map(({ row }) => row.recordId)
    ).toEqual(["e", "a"]);
  });

  it("says why a named record cannot run", () => {
    const selection = selectBenchRunEntries({
      entries,
      input: { recordIds: ["b"] },
    });
    expect(selection.ok).toBe(false);
    expect(!selection.ok && selection.error).toContain("input mapping");
  });

  it("says when a named record is not listed", () => {
    const selection = selectBenchRunEntries({
      entries,
      input: { recordIds: ["zzz"] },
    });
    expect(!selection.ok && selection.error).toContain("not listed");
  });

  it("says when no record matches the scope", () => {
    const selection = selectBenchRunEntries({ entries: [], input: {} });
    expect(!selection.ok && selection.error).toContain("No records match");
  });
});

describe("bench summaries", () => {
  it("summarizes an annotated run", () => {
    expect(summarizeFinishedRun({ row: makeRow("a"), run: DONE_RUN })).toEqual({
      recordId: "a",
      name: "ChatCompletion",
      status: "annotated",
      annotations: [
        {
          name: "helpfulness",
          label: "helpful",
          score: 1,
          explanation: "Answers the question.",
        },
      ],
      errors: [],
    });
  });

  it("summarizes a run that produced no annotation as failed", () => {
    const summary = summarizeFinishedRun({
      row: makeRow("a"),
      run: {
        status: "done",
        fingerprint: "f",
        results: [
          { evaluatorName: "x", annotation: null, error: "sandbox timed out" },
        ],
      },
    });
    expect(summary).toMatchObject({
      status: "failed",
      errors: ["sandbox timed out"],
    });
  });

  it("lists a stale result as stale", () => {
    const summary = summarizeBenchEntry(
      makeEntry("a", {
        kind: "annotated",
        annotations: [{ name: "x", label: "ok", score: 1, explanation: null }],
        errors: [],
        isStale: true,
      })
    );
    expect(summary).toMatchObject({ status: "annotated", isStale: true });
  });
});

function makeHost(
  overrides: Partial<ProjectEvaluatorBenchHost> = {}
): ProjectEvaluatorBenchHost {
  const entries = [makeEntry("a"), makeEntry("b")];
  return {
    targetType: "SPAN",
    filterCondition: "span_kind == 'LLM'",
    getEntries: () => entries,
    getSnapshot: () => ({
      targetType: "SPAN",
      recordKind: "span",
      timeWindow: "7d",
      records: entries.map(summarizeBenchEntry),
      hasMore: false,
      runBlocker: null,
    }),
    runEntries: async (selected) => selected.map(() => DONE_RUN),
    ...overrides,
  };
}

const SCOPE = {
  targetType: "SPAN" as const,
  filterCondition: "span_kind == 'LLM'",
};

describe("project evaluator bench client actions", () => {
  it("runs the selected records through the bench and returns verdicts", async () => {
    const runEntries = vi.fn(async (selected: RecordedRunEntry[]) =>
      selected.map(() => DONE_RUN)
    );
    const host = makeHost({ runEntries });
    const run = createRunProjectEvaluatorBenchClientAction({
      getHost: () => host,
      getScope: () => SCOPE,
    });
    const result = await run({ count: 2 });
    expect(runEntries).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      ok: true,
      output: { tested: 2, failed: 0 },
    });
  });

  it("waits for the bench of the current scope to load", async () => {
    let host: ProjectEvaluatorBenchHost | null = makeHost({
      filterCondition: "parent_id is None",
    });
    const read = createReadProjectEvaluatorBenchClientAction({
      getHost: () => host,
      getScope: () => SCOPE,
      pollIntervalMs: 1,
      loadTimeoutMs: 1_000,
    });
    setTimeout(() => {
      host = makeHost();
    }, 5);
    const result = await read();
    expect(result.ok).toBe(true);
  });

  it("gives up when the bench never loads the current scope", async () => {
    const read = createReadProjectEvaluatorBenchClientAction({
      getHost: () => null,
      getScope: () => SCOPE,
      pollIntervalMs: 1,
      loadTimeoutMs: 5,
    });
    const result = await read();
    expect(result.ok).toBe(false);
  });

  it("reports what blocks every test instead of running", async () => {
    const runEntries = vi.fn();
    const host = makeHost({
      runEntries,
      getSnapshot: () => ({
        ...makeHost().getSnapshot(),
        runBlocker: "Fix the evaluator's annotation configuration to test",
      }),
    });
    const run = createRunProjectEvaluatorBenchClientAction({
      getHost: () => host,
      getScope: () => SCOPE,
    });
    const result = await run({});
    expect(result.ok).toBe(false);
    expect(runEntries).not.toHaveBeenCalled();
  });
});
