/**
 * The inputs view renders what `materializeEvaluatorContext` produces, so this
 * only checks what reaches the table: the key order, the resolved values, and
 * the diagnostics listed above it. What the materialization binds is pinned
 * where it lives.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { installTestMatchMedia } from "@phoenix/__tests__/installTestMatchMedia";
import { EvaluatorInputVariablesContext } from "@phoenix/components/evaluators/EvaluatorInputVariablesContext/evaluatorInputVariablesContext";
import { ThemeProvider } from "@phoenix/contexts/ThemeContext";
import {
  EvaluatorInputsView,
  getEvaluatorRecordInputs,
} from "@phoenix/pages/project/evaluators/ProjectEvaluatorBindingPreview";
import { ProjectEvaluatorRecordTable } from "@phoenix/pages/project/evaluators/ProjectEvaluatorRecordTable";
import {
  formatBulkTestLabel,
  formatRecordedRunSummary,
  getContextSnippet,
  getRecordedRunResultState,
  summarizeRecordedRuns,
  toReadableValue,
} from "@phoenix/pages/project/evaluators/projectEvaluatorTestBenchTypes";
import { getSampleSpanEvaluationContext } from "@phoenix/pages/project/evaluators/sampleSpanEvaluationContext";
import { getSampleTraceEvaluationContext } from "@phoenix/pages/project/evaluators/sampleTraceEvaluationContext";

describe("the evaluator inputs", () => {
  let container: HTMLDivElement;
  let root: Root;

  // `ThemeProvider` reads the system theme on mount; jsdom has no matchMedia.
  installTestMatchMedia();

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("lists input and output first, then the evaluator's other variables, then metadata", () => {
    const { values } = getEvaluatorRecordInputs({
      context: getSampleSpanEvaluationContext().context,
      recordKind: "span",
      inputMapping: {
        pathMapping: { context: "metadata.name" },
        literalMapping: {},
      },
      declaredVariables: ["context", "input"],
    });
    expect(Object.keys(values)).toEqual([
      "input",
      "output",
      "context",
      "metadata",
    ]);
  });

  it("reads a slot through the path set on it", () => {
    const context = getSampleSpanEvaluationContext().context;
    const { values } = getEvaluatorRecordInputs({
      context,
      recordKind: "span",
      inputMapping: {
        pathMapping: { input: "metadata.name" },
        literalMapping: {},
      },
      declaredVariables: ["input", "output", "metadata"],
    });
    expect(values.input).toBe(context.metadata.name);
    expect(values.output).toBe(context.output);
  });

  it("shows a variable bound to saved text as that text, not as missing", () => {
    const { values, diagnostics } = getEvaluatorRecordInputs({
      context: getSampleSpanEvaluationContext().context,
      recordKind: "span",
      inputMapping: {
        pathMapping: {},
        literalMapping: { reference: "STALE LITERAL" },
      },
      declaredVariables: ["output", "reference"],
      requiredVariables: ["output", "reference"],
    });
    expect(values.reference).toBe("STALE LITERAL");
    expect(diagnostics.every(({ status }) => status === "resolved")).toBe(true);
  });

  it("shows the saved text for a variable that also has a path, as the server applies it", () => {
    const { values } = getEvaluatorRecordInputs({
      context: getSampleSpanEvaluationContext().context,
      recordKind: "span",
      inputMapping: {
        pathMapping: { context: "metadata.name" },
        literalMapping: { context: "PINNED TEXT" },
      },
      declaredVariables: ["output", "context"],
    });
    expect(values.context).toBe("PINNED TEXT");
  });

  it("lists what fails to bind above the table, in declaration order, and leaves it out of the rows", async () => {
    await act(async () => {
      root.render(
        <ThemeProvider themeMode="light" disableBodyTheme>
          <EvaluatorInputVariablesContext.Provider
            value={["input", "metadata", "any_thing"]}
          >
            <EvaluatorInputsView
              context={getSampleTraceEvaluationContext().context}
              recordKind="trace"
              inputMapping={{
                pathMapping: { input: "missing.key", metadata: "nope" },
                literalMapping: {},
              }}
              requiredVariables={["input", "metadata", "any_thing"]}
              isSampleContext={false}
            />
          </EvaluatorInputVariablesContext.Provider>
        </ThemeProvider>
      );
    });

    const errors = [
      ...container.querySelectorAll(
        '.inputs-view__diagnostic[data-variant="error"]'
      ),
    ];
    expect(
      errors.map((node) => node.querySelector("code")?.textContent)
    ).toEqual(["input", "metadata", "any_thing"]);
    expect(
      errors.map((node) => node.querySelector("span")?.textContent)
    ).toEqual([
      "missing.key does not exist on this trace, so evaluation fails",
      "nope does not exist on this trace, so evaluation fails",
      "any_thing does not exist on this trace, so evaluation fails",
    ]);
    expect(errors[0]?.querySelector('[aria-label="error"]')).not.toBeNull();
    // The table still lists what did bind; the variables with nothing to
    // show are not given empty rows.
    const keys = [...container.querySelectorAll(".json-table__key")].map(
      (node) => node.textContent
    );
    expect(keys).toContain("output");
    expect(keys).not.toContain("input");
    expect(keys).not.toContain("any_thing");
  });

  it("lists a path only the server can check as a warning, not an error", async () => {
    await act(async () => {
      root.render(
        <ThemeProvider themeMode="light" disableBodyTheme>
          <EvaluatorInputVariablesContext.Provider
            value={["input", "output", "metadata", "citations"]}
          >
            <EvaluatorInputsView
              context={getSampleSpanEvaluationContext().context}
              recordKind="span"
              inputMapping={{
                pathMapping: {
                  // A wildcard is the server's to resolve, so this side can
                  // only defer — unlike `nope`, which is checked and wrong.
                  input: "metadata.attributes.llm.input_messages[*].message",
                  output: "nope",
                  citations: "metadata.annotations[*]",
                },
                literalMapping: {},
              }}
              requiredVariables={["input", "output", "metadata", "citations"]}
              isSampleContext={false}
            />
          </EvaluatorInputVariablesContext.Provider>
        </ThemeProvider>
      );
    });

    const warnings = [
      ...container.querySelectorAll(
        '.inputs-view__diagnostic[data-variant="warning"]'
      ),
    ];
    expect(
      warnings.map((node) => node.querySelector("code")?.textContent)
    ).toEqual(["input", "citations"]);
    expect(
      warnings.map((node) => node.querySelector("span")?.textContent)
    ).toEqual([
      "metadata.attributes.llm.input_messages[*].message is checked when the evaluator runs",
      "metadata.annotations[*] is checked when the evaluator runs",
    ]);
    expect(
      [
        ...container.querySelectorAll(
          '.inputs-view__diagnostic[data-variant="error"]'
        ),
      ].map((node) => node.querySelector("code")?.textContent)
    ).toEqual(["output"]);
    // Nothing here is a banner.
    expect(container.querySelector(".alert__icon-title-wrap")).toBeNull();
  });

  it("renders the bound values as a key/value table whose keys are paths", async () => {
    await act(async () => {
      root.render(
        <ThemeProvider themeMode="light" disableBodyTheme>
          <EvaluatorInputVariablesContext.Provider
            value={["input", "output", "reference"]}
          >
            <EvaluatorInputsView
              context={{
                input: "hello",
                output: "world",
                metadata: { name: "chat", attributes: { kind: "LLM" } },
              }}
              recordKind="span"
              inputMapping={{
                pathMapping: { reference: "output" },
                literalMapping: {},
              }}
              isSampleContext={false}
            />
          </EvaluatorInputVariablesContext.Provider>
        </ThemeProvider>
      );
    });

    const keys = [...container.querySelectorAll(".json-table__key")].map(
      (node) => node.textContent
    );
    // Metadata keys follow the mapping vocabulary's order, attributes
    // before the record's own fields, rather than the order they arrived in.
    expect(keys).toEqual([
      "input",
      "output",
      "reference",
      "metadata.attributes.kind",
      "metadata.name",
    ]);
    const referenceRow = [...container.querySelectorAll("tbody tr")].find(
      (row) =>
        row.querySelector(".json-table__key")?.textContent === "reference"
    );
    expect(referenceRow?.querySelector(".json-table__value")?.textContent).toBe(
      "world"
    );
  });

  it("marks a row whose mapping cannot bind, and disables its test button", async () => {
    const onFocusRow = vi.fn();
    await act(async () => {
      root.render(
        <ThemeProvider themeMode="light" disableBodyTheme>
          <EvaluatorInputVariablesContext.Provider
            value={["input", "tool_call"]}
          >
            <ProjectEvaluatorRecordTable
              entries={[
                {
                  row: {
                    key: "span-id",
                    name: "errored span",
                    recordId: "abcdef1234567890",
                    context: { input: "hello" },
                    isSample: false,
                  },
                  missingCount: 2,
                  run: undefined,
                  resultState: { kind: "missing", count: 2 },
                },
                {
                  row: {
                    key: "other-span",
                    name: "fine span",
                    recordId: "0123456789abcdef",
                    context: { input: "hello", tool_call: "x" },
                    isSample: false,
                  },
                  missingCount: 0,
                  run: undefined,
                  resultState: { kind: "idle" },
                },
              ]}
              recordKind="span"
              focusedRowKey="span-id"
              onFocusRow={onFocusRow}
              isRunnable
              runBlocker={null}
              onRunRow={() => {}}
              hasMore={false}
              isLoadingMore={false}
              onLoadMore={() => {}}
            />
          </EvaluatorInputVariablesContext.Provider>
        </ThemeProvider>
      );
    });

    const rows = [...container.querySelectorAll("tbody tr")];
    expect(rows).toHaveLength(2);
    // The focused row is the one the inspector shows.
    expect(rows[0]?.getAttribute("data-selected")).toBe("true");
    expect(rows[1]?.getAttribute("data-selected")).toBe("false");
    // The row says how many inputs bind nothing instead of hiding it
    // behind a counter, and the test control sits in the same cell.
    const resultCells = rows.map((row) => row.querySelector("td:last-of-type"));
    expect(resultCells[0]?.textContent).toContain("2 inputs missing");
    expect(
      resultCells[0]
        ?.querySelector('button[aria-label^="Test evaluator on errored span"]')
        ?.hasAttribute("disabled")
    ).toBe(true);
    // The id column shows the recognisable head of the id, not all of it.
    expect(rows[0]?.textContent).toContain("abcdef12");
    expect(rows[0]?.textContent).not.toContain("abcdef1234567890");
    // A row that binds is testable and reads as not yet tested.
    expect(resultCells[1]?.textContent).toContain("Not tested");
    expect(
      resultCells[1]
        ?.querySelector('button[aria-label^="Test evaluator on fine span"]')
        ?.hasAttribute("disabled")
    ).toBe(false);
    // No checkbox column: the header button tests every row that can run.
    expect(container.querySelector('input[type="checkbox"]')).toBeNull();

    await act(async () => {
      rows[1]?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onFocusRow).toHaveBeenCalledWith("other-span");
  });
});

describe("the recorded run result state", () => {
  const annotation = {
    name: "correctness",
    label: "correct",
    score: 1,
    explanation: null,
  };
  const annotatedRun = {
    status: "done" as const,
    fingerprint: "v1",
    results: [{ evaluatorName: "correctness", annotation, error: null }],
  };

  it("reports a record nothing can run on before anything else", () => {
    expect(
      getRecordedRunResultState({
        run: { status: "running", fingerprint: "v1" },
        missingCount: 2,
        isUnavailable: true,
        currentFingerprint: "v1",
      })
    ).toEqual({ kind: "unavailable" });
  });

  it("lets a run in flight speak over a missing input, since it is already underway", () => {
    expect(
      getRecordedRunResultState({
        run: { status: "running", fingerprint: "v1" },
        missingCount: 1,
        isUnavailable: false,
        currentFingerprint: "v1",
      })
    ).toEqual({ kind: "running" });
  });

  it("lets a current missing input speak over an earlier verdict, so the row cannot be re-run into a failure", () => {
    expect(
      getRecordedRunResultState({
        run: annotatedRun,
        missingCount: 1,
        isUnavailable: false,
        currentFingerprint: "v1",
      })
    ).toEqual({ kind: "missing", count: 1 });
  });

  it("marks a verdict stale once the evaluator definition moves on", () => {
    expect(
      getRecordedRunResultState({
        run: annotatedRun,
        missingCount: 0,
        isUnavailable: false,
        currentFingerprint: "v1",
      })
    ).toEqual({ kind: "annotated", annotation, isStale: false });
    expect(
      getRecordedRunResultState({
        run: annotatedRun,
        missingCount: 0,
        isUnavailable: false,
        currentFingerprint: "v2",
      })
    ).toEqual({ kind: "annotated", annotation, isStale: true });
  });

  it("reads a run without a verdict as failed, and no run as idle or missing", () => {
    expect(
      getRecordedRunResultState({
        run: {
          status: "done",
          fingerprint: "v1",
          results: [
            { evaluatorName: "correctness", annotation: null, error: "boom" },
          ],
        },
        missingCount: 0,
        isUnavailable: false,
        currentFingerprint: "v1",
      })
    ).toEqual({ kind: "failed", isStale: false });
    expect(
      getRecordedRunResultState({
        run: { status: "error", fingerprint: "v1", message: "network" },
        missingCount: 0,
        isUnavailable: false,
        currentFingerprint: "v2",
      })
    ).toEqual({ kind: "failed", isStale: true });
    expect(
      getRecordedRunResultState({
        run: undefined,
        missingCount: 3,
        isUnavailable: false,
        currentFingerprint: "v1",
      })
    ).toEqual({ kind: "missing", count: 3 });
    expect(
      getRecordedRunResultState({
        run: undefined,
        missingCount: 0,
        isUnavailable: false,
        currentFingerprint: "v1",
      })
    ).toEqual({ kind: "idle" });
  });
});

describe("the bench summary and bulk button", () => {
  const row = (key: string) => ({
    key,
    name: key,
    recordId: key,
    context: {},
    isSample: false,
  });

  it("counts stale results apart from tested ones", () => {
    const summary = summarizeRecordedRuns([
      {
        row: row("a"),
        missingCount: 0,
        run: undefined,
        resultState: {
          kind: "annotated",
          annotation: { name: "n", label: "l", score: 1, explanation: null },
          isStale: false,
        },
      },
      {
        row: row("b"),
        missingCount: 0,
        run: undefined,
        resultState: {
          kind: "annotated",
          annotation: { name: "n", label: "l", score: 1, explanation: null },
          isStale: true,
        },
      },
      {
        row: row("c"),
        missingCount: 0,
        run: undefined,
        resultState: { kind: "failed", isStale: false },
      },
      {
        row: row("d"),
        missingCount: 0,
        run: undefined,
        resultState: { kind: "running" },
      },
      {
        row: row("e"),
        missingCount: 1,
        run: undefined,
        resultState: { kind: "missing", count: 1 },
      },
    ]);
    expect(summary).toEqual({
      tested: 1,
      stale: 1,
      failed: 1,
      running: 1,
      notTested: 1,
    });
    expect(formatRecordedRunSummary(summary)).toBe(
      "1 tested · 1 testing · 1 stale · 1 failed · 1 not tested"
    );
  });

  it('claims "all" only when every listed row can run', () => {
    expect(
      formatBulkTestLabel({
        runnableCount: 10,
        totalCount: 10,
        isRetest: false,
      })
    ).toBe("Test all 10");
    expect(
      formatBulkTestLabel({ runnableCount: 7, totalCount: 10, isRetest: false })
    ).toBe("Test 7 of 10");
    expect(
      formatBulkTestLabel({ runnableCount: 0, totalCount: 10, isRetest: false })
    ).toBe("Test all");
  });

  it("says Re-test once every row that will run already has a result", () => {
    expect(
      formatBulkTestLabel({ runnableCount: 8, totalCount: 10, isRetest: true })
    ).toBe("Re-test 8 of 10");
  });
});

describe("the row excerpt", () => {
  it("unwraps the one-key envelope the server puts around a plain string", () => {
    expect(
      getContextSnippet({ input: { input: "How long do refunds take?" } })
    ).toBe("How long do refunds take?");
    expect(toReadableValue({ output: "Refunds take 3 to 5 days." })).toBe(
      "Refunds take 3 to 5 days."
    );
  });

  it("leaves anything with more structure alone", () => {
    const structured = { input: "hi", attachments: [] };
    expect(toReadableValue(structured)).toBe(structured);
    expect(toReadableValue({ input: 3 })).toEqual({ input: 3 });
  });

  it("surfaces the last message of a chat payload", () => {
    expect(
      getContextSnippet({
        input: {
          messages: [
            { role: "system", content: "Be brief." },
            { role: "user", content: "Where is order 42?" },
          ],
        },
      })
    ).toBe("Where is order 42?");
  });
});
