/**
 * The inputs view renders what `materializeEvaluatorContext` produces, so this
 * only checks what reaches the view: a row per variable with its status,
 * source and value, and the record's context below them. What the materialization binds is pinned
 * where it lives.
 */
import { act, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { installTestMatchMedia } from "@phoenix/__tests__/installTestMatchMedia";
import { EvaluatorInputVariablesContext } from "@phoenix/components/evaluators/EvaluatorInputVariablesContext/evaluatorInputVariablesContext";
import { EvaluatorStoreProvider } from "@phoenix/contexts/EvaluatorContext";
import { ThemeProvider } from "@phoenix/contexts/ThemeContext";
import {
  EvaluatorInputsView,
  getEvaluatorRecordInputs,
  getRecordMappingDiagnostics,
} from "@phoenix/pages/project/evaluators/ProjectEvaluatorBindingPreview";
import { ProjectEvaluatorRecordInspector } from "@phoenix/pages/project/evaluators/ProjectEvaluatorRecordInspector";
import { ProjectEvaluatorRecordTable } from "@phoenix/pages/project/evaluators/ProjectEvaluatorRecordTable";
import {
  type RecordedRunEntry,
  formatBulkTestLabel,
  formatRecordedRunSummary,
  getContextSnippet,
  getRecordedRunResultState,
  summarizeRecordedRuns,
  toReadableValue,
} from "@phoenix/pages/project/evaluators/projectEvaluatorTestBenchTypes";
import { getSampleSpanEvaluationContext } from "@phoenix/pages/project/evaluators/sampleSpanEvaluationContext";
import { getSampleTraceEvaluationContext } from "@phoenix/pages/project/evaluators/sampleTraceEvaluationContext";
import { DEFAULT_LLM_EVALUATOR_STORE_VALUES } from "@phoenix/store/evaluatorStore";

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

  async function renderInputsView({
    variables,
    evaluatorKind = "LLM",
    ...props
  }: Omit<ComponentProps<typeof EvaluatorInputsView>, "isSampleContext"> & {
    variables: string[];
    evaluatorKind?: "LLM" | "CODE";
  }) {
    await act(async () => {
      root.render(
        <ThemeProvider themeMode="light" disableBodyTheme>
          <EvaluatorStoreProvider
            initialState={{
              ...DEFAULT_LLM_EVALUATOR_STORE_VALUES,
              evaluator: {
                ...DEFAULT_LLM_EVALUATOR_STORE_VALUES.evaluator,
                kind: evaluatorKind,
              },
            }}
          >
            <EvaluatorInputVariablesContext.Provider value={variables}>
              <EvaluatorInputsView {...props} isSampleContext={false} />
            </EvaluatorInputVariablesContext.Provider>
          </EvaluatorStoreProvider>
        </ThemeProvider>
      );
    });
  }

  const items = () => [...container.querySelectorAll(".inputs-view__item")];
  const itemFor = (variable: string) =>
    items().find(
      (item) =>
        item.querySelector(".inputs-view__variable")?.textContent ===
        `{{${variable}}}`
    );

  it("gives every declared variable a row, in declaration order, and marks what fails to bind", async () => {
    await renderInputsView({
      variables: ["input", "metadata", "any_thing"],
      context: getSampleTraceEvaluationContext().context,
      recordKind: "trace",
      inputMapping: {
        pathMapping: { input: "missing.key", metadata: "nope" },
        literalMapping: {},
      },
      requiredVariables: ["input", "metadata", "any_thing"],
    });

    expect(
      items().map(
        (item) => item.querySelector(".inputs-view__variable")?.textContent
      )
    ).toEqual(["{{input}}", "{{metadata}}", "{{any_thing}}"]);
    expect(items().map((item) => item.getAttribute("data-status"))).toEqual([
      "missing",
      "missing",
      "missing",
    ]);
    // A path that reads nothing says so in the shared wording; a variable
    // with no path at all says there is nothing of its name to fall back to.
    expect(itemFor("input")?.textContent).toContain(
      "missing.key does not exist on this trace, so evaluation fails"
    );
    expect(itemFor("metadata")?.textContent).toContain(
      "nope does not exist on this trace, so evaluation fails"
    );
    expect(itemFor("any_thing")?.textContent).toContain("Not mapped");
    expect(itemFor("any_thing")?.textContent).toContain(
      "Nothing on the trace is named any_thing"
    );
  });

  it("marks a path only the server can check as checked at run, not as failing", async () => {
    await renderInputsView({
      variables: ["input", "output", "metadata", "citations"],
      context: getSampleSpanEvaluationContext().context,
      recordKind: "span",
      inputMapping: {
        pathMapping: {
          // A wildcard is the server's to resolve, so this side can only
          // defer — unlike `nope`, which is checked and wrong.
          input: "metadata.attributes.llm.input_messages[*].message",
          output: "nope",
          citations: "metadata.annotations[*]",
        },
        literalMapping: {},
      },
      requiredVariables: ["input", "output", "metadata", "citations"],
    });

    expect(itemFor("input")?.getAttribute("data-status")).toBe("unverified");
    expect(itemFor("input")?.textContent).toContain(
      "metadata.attributes.llm.input_messages[*].message is checked when the evaluator runs"
    );
    expect(itemFor("citations")?.getAttribute("data-status")).toBe(
      "unverified"
    );
    expect(itemFor("output")?.getAttribute("data-status")).toBe("missing");
    expect(itemFor("metadata")?.getAttribute("data-status")).toBe("resolved");
    // What fails the run leads the list.
    expect(
      items()[0]?.querySelector(".inputs-view__variable")?.textContent
    ).toBe("{{output}}");
    // Nothing here is a banner.
    expect(container.querySelector(".alert__icon-title-wrap")).toBeNull();
  });

  it("shows each variable's source and value, and the whole record below them", async () => {
    await renderInputsView({
      variables: ["input", "output", "reference"],
      context: {
        input: "hello",
        output: "world",
        metadata: { name: "chat", attributes: { kind: "LLM" } },
      },
      recordKind: "span",
      inputMapping: {
        pathMapping: { reference: "output" },
        literalMapping: {},
      },
    });

    expect(
      itemFor("input")?.querySelector(".inputs-view__value")?.textContent
    ).toBe("hello");
    expect(itemFor("input")?.textContent).toContain("default");
    const reference = itemFor("reference");
    expect(
      reference?.querySelector(".inputs-view__source code")?.textContent
    ).toBe("output");
    expect(reference?.querySelector(".inputs-view__value")?.textContent).toBe(
      "world"
    );

    const keys = [...container.querySelectorAll(".json-table__key")].map(
      (node) => node.textContent
    );
    // Metadata keys follow the mapping vocabulary's order, attributes before
    // the record's own fields, rather than the order they arrived in.
    expect(keys).toEqual([
      "input",
      "output",
      "metadata.attributes.kind",
      "metadata.name",
    ]);
  });

  it("lists the variables that fail the run first, the rest in declaration order", async () => {
    await renderInputsView({
      variables: ["input", "reference", "output", "context"],
      context: getSampleSpanEvaluationContext().context,
      recordKind: "span",
      inputMapping: { pathMapping: {}, literalMapping: {} },
    });
    expect(
      items().map(
        (item) => item.querySelector(".inputs-view__variable")?.textContent
      )
    ).toEqual(["{{reference}}", "{{context}}", "{{input}}", "{{output}}"]);
  });

  it("shows an empty state rather than the record's fields when nothing is declared", async () => {
    await renderInputsView({
      variables: [],
      context: getSampleSpanEvaluationContext().context,
      recordKind: "span",
      inputMapping: { pathMapping: {}, literalMapping: {} },
    });
    // input, output, and metadata are not listed on the prompt's behalf.
    expect(items()).toHaveLength(0);
    const empty = container.querySelector(".inputs-view__empty");
    expect(empty?.textContent).toContain("No variables");
    expect(empty?.textContent).toContain(
      "Use a variable in the prompt to pass the evaluator data from this span."
    );
    // The record's data is still there to map from.
    expect(
      container.querySelectorAll(".json-table__key").length
    ).toBeGreaterThan(0);
  });

  it("words the empty state for a code evaluator's parameters", async () => {
    await renderInputsView({
      variables: [],
      evaluatorKind: "CODE",
      context: getSampleTraceEvaluationContext().context,
      recordKind: "trace",
      inputMapping: { pathMapping: {}, literalMapping: {} },
    });
    expect(
      container.querySelector(".inputs-view__empty")?.textContent
    ).toContain(
      "Add a parameter to the evaluator's function to pass it data from this trace."
    );
  });

  it("counts nothing missing on a record when nothing is declared", () => {
    expect(
      getRecordMappingDiagnostics({
        context: getSampleSpanEvaluationContext().context,
        inputMapping: { pathMapping: {}, literalMapping: {} },
        declaredVariables: [],
      })
    ).toEqual([]);
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
  it("puts a verdict's explanation and an error's message under the result", async () => {
    const tableRow = (key: string, name: string) => ({
      key,
      name,
      recordId: `${key}-0123456789`,
      context: { input: "hello" },
      isSample: false,
    });
    await act(async () => {
      root.render(
        <ThemeProvider themeMode="light" disableBodyTheme>
          <EvaluatorStoreProvider
            initialState={DEFAULT_LLM_EVALUATOR_STORE_VALUES}
          >
            <EvaluatorInputVariablesContext.Provider value={["input"]}>
              <ProjectEvaluatorRecordTable
                entries={[
                  {
                    row: tableRow("a", "judged span"),
                    missingCount: 0,
                    run: undefined,
                    resultState: {
                      kind: "annotated",
                      annotations: [
                        {
                          name: "correctness",
                          label: "true",
                          score: 1,
                          explanation: "It answers the question.",
                        },
                      ],
                      isStale: false,
                    },
                  },
                  {
                    row: tableRow("b", "failed span"),
                    missingCount: 0,
                    run: undefined,
                    resultState: {
                      kind: "failed",
                      message: "No sandbox configuration selected",
                      isStale: false,
                    },
                  },
                ]}
                recordKind="span"
                focusedRowKey="a"
                onFocusRow={() => {}}
                isRunnable
                runBlocker={null}
                onRunRow={() => {}}
                hasMore={false}
                isLoadingMore={false}
                onLoadMore={() => {}}
              />
            </EvaluatorInputVariablesContext.Provider>
          </EvaluatorStoreProvider>
        </ThemeProvider>
      );
    });
    const details = [...container.querySelectorAll(".result-cell__detail")];
    expect(details.map((node) => node.textContent)).toEqual([
      "It answers the question.",
      "No sandbox configuration selected",
    ]);
    // The whole of a cut line is a hover away.
    expect(details.map((node) => node.getAttribute("title"))).toEqual([
      "It answers the question.",
      "No sandbox configuration selected",
    ]);
    expect(details[1]?.getAttribute("data-variant")).toBe("danger");
  });
  it("shows the last result beside the inspector's Test button", async () => {
    const renderInspector = (
      resultState: RecordedRunEntry["resultState"],
      run?: RecordedRunEntry["run"]
    ) =>
      act(async () => {
        root.render(
          <ThemeProvider themeMode="light" disableBodyTheme>
            <EvaluatorStoreProvider
              initialState={DEFAULT_LLM_EVALUATOR_STORE_VALUES}
            >
              <EvaluatorInputVariablesContext.Provider value={["input"]}>
                <ProjectEvaluatorRecordInspector
                  entry={{
                    row: {
                      key: "a",
                      name: "judged span",
                      recordId: "a-0123456789",
                      context: { input: "hello", metadata: {} },
                      isSample: false,
                    },
                    missingCount: 0,
                    run,
                    resultState,
                  }}
                  recordKind="span"
                  inputMapping={{ pathMapping: {}, literalMapping: {} }}
                  isRunnable
                  runBlocker={null}
                  onRun={() => {}}
                />
              </EvaluatorInputVariablesContext.Provider>
            </EvaluatorStoreProvider>
          </ThemeProvider>
        );
      });
    const segment = () =>
      container.querySelector('[aria-label="Last test result"]');

    await renderInspector({ kind: "idle" });
    expect(segment()).toBeNull();

    await renderInspector({
      kind: "annotated",
      annotations: [
        { name: "correctness", label: "true", score: 1, explanation: null },
      ],
      isStale: true,
    });
    expect(segment()?.textContent).toContain("Last result (stale)");
    expect(segment()?.textContent).toContain("true");
    // It sits in the header, with the button that produced it.
    expect(segment()?.closest("header")).not.toBeNull();

    await renderInspector({ kind: "failed", message: "boom", isStale: false });
    expect(segment()?.textContent).toContain("Error");

    // A test in flight holds the segment's place under a skeleton: a re-test
    // keeps the previous result laid out, hidden, beneath it.
    await renderInspector(
      { kind: "running" },
      {
        status: "running",
        fingerprint: "v2",
        previous: { status: "error", fingerprint: "v1", message: "boom" },
      }
    );
    expect(segment()?.getAttribute("aria-busy")).toBe("true");
    expect(segment()?.querySelector(".skeleton")).not.toBeNull();
    expect(
      segment()?.querySelector(".record-inspector__last-result-held")
        ?.textContent
    ).toContain("Error");
    await renderInspector(
      { kind: "running" },
      { status: "running", fingerprint: "v1" }
    );
    expect(segment()?.querySelector(".skeleton")).not.toBeNull();
    expect(
      segment()?.querySelector(".record-inspector__last-result-held")
    ).toBeNull();
    // The button keeps its label while it runs; a spinner takes the icon.
    const button = [...container.querySelectorAll("header button")].pop();
    expect(button?.getAttribute("aria-label")).toBe("Test");
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
    ).toEqual({ kind: "annotated", annotations: [annotation], isStale: false });
    expect(
      getRecordedRunResultState({
        run: annotatedRun,
        missingCount: 0,
        isUnavailable: false,
        currentFingerprint: "v2",
      })
    ).toEqual({ kind: "annotated", annotations: [annotation], isStale: true });
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
    ).toEqual({ kind: "failed", message: "boom", isStale: false });
    expect(
      getRecordedRunResultState({
        run: { status: "error", fingerprint: "v1", message: "network" },
        missingCount: 0,
        isUnavailable: false,
        currentFingerprint: "v2",
      })
    ).toEqual({ kind: "failed", message: "network", isStale: true });
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
          annotations: [{ name: "n", label: "l", score: 1, explanation: null }],
          isStale: false,
        },
      },
      {
        row: row("b"),
        missingCount: 0,
        run: undefined,
        resultState: {
          kind: "annotated",
          annotations: [{ name: "n", label: "l", score: 1, explanation: null }],
          isStale: true,
        },
      },
      {
        row: row("c"),
        missingCount: 0,
        run: undefined,
        resultState: { kind: "failed", message: "boom", isStale: false },
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
