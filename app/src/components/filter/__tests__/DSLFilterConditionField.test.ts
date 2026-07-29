import type {
  CompletionContext,
  CompletionResult,
} from "@codemirror/autocomplete";
import { describe, expect, it } from "vitest";

import {
  createDSLFilterCompletionSource,
  type DSLFilterCompletionRequest,
  detectDSLFilterComprehensionCall,
  detectDSLFilterComprehensionScope,
  detectDSLFilterForClauseTarget,
  findDSLFilterComprehensionRange,
  getDSLFilterCompletionTokenBeforeCursor,
  shouldSuppressDSLFilterCompletionsInString,
} from "../dslFilterConditionFieldUtils";

const sessionIterableNames = new Set([
  "spans",
  "traces",
  "session_annotations",
  "span_annotations",
  "span_cost_details",
]);

/** Splits a condition at the `|` marking the cursor. */
function detectScopeAtCursor(conditionWithCursor: string) {
  const cursorIndex = conditionWithCursor.indexOf("|");
  return detectDSLFilterComprehensionScope({
    textBeforeCursor: conditionWithCursor.slice(0, cursorIndex),
    textAfterCursor: conditionWithCursor.slice(cursorIndex + 1),
    isIterableName: (name) => sessionIterableNames.has(name),
  });
}

describe("DSLFilterConditionField completion helpers", () => {
  it("includes quoted subscripts with spaces in the replacement token", () => {
    const textBeforeCursor = "annotations['Human Fee";
    const token = getDSLFilterCompletionTokenBeforeCursor(textBeforeCursor);

    expect(token).toEqual({
      from: 0,
      to: textBeforeCursor.length,
      text: textBeforeCursor,
    });
    expect(
      shouldSuppressDSLFilterCompletionsInString({
        textBeforeCursor,
        tokenFrom: token.from,
      })
    ).toBe(false);
  });

  it("includes integer-indexed attribute paths in the replacement token", () => {
    const textBeforeCursor =
      "attributes['llm']['input_messages'][0]['message']['role";

    expect(getDSLFilterCompletionTokenBeforeCursor(textBeforeCursor)).toEqual({
      from: 0,
      to: textBeforeCursor.length,
      text: textBeforeCursor,
    });
  });

  it("includes trailing member-access dots in the replacement token", () => {
    expect(getDSLFilterCompletionTokenBeforeCursor("input.")).toEqual({
      from: 0,
      to: "input.".length,
      text: "input.",
    });
    expect(
      getDSLFilterCompletionTokenBeforeCursor("annotations['quality'].")
    ).toEqual({
      from: 0,
      to: "annotations['quality'].".length,
      text: "annotations['quality'].",
    });
  });

  it("suppresses field completions inside ordinary string values", () => {
    const textBeforeCursor =
      "attributes['input']['mime_type'] == 'application/js";
    const token = getDSLFilterCompletionTokenBeforeCursor(textBeforeCursor);

    expect(token.text).toBe("js");
    expect(
      shouldSuppressDSLFilterCompletionsInString({
        textBeforeCursor,
        tokenFrom: token.from,
      })
    ).toBe(true);
  });

  it("does not suppress completions after a closed string value", () => {
    const textBeforeCursor = "span_kind == 'LLM' and sta";
    const token = getDSLFilterCompletionTokenBeforeCursor(textBeforeCursor);

    expect(token.text).toBe("sta");
    expect(
      shouldSuppressDSLFilterCompletionsInString({
        textBeforeCursor,
        tokenFrom: token.from,
      })
    ).toBe(false);
  });
});

describe("DSL filter comprehension scope detection", () => {
  it("classifies the cursor inside a comprehension whose `for` clause follows it", () => {
    // The shape the `any(...)` skeleton leaves behind: cursor on the
    // predicate, loop variable and collection already typed to its right.
    expect(detectScopeAtCursor("any(| for s in spans)")).toEqual({
      iterableName: "spans",
      loopVariable: "s",
    });
    expect(detectScopeAtCursor("any(s.stat| for s in spans)")).toEqual({
      iterableName: "spans",
      loopVariable: "s",
    });
    expect(
      detectScopeAtCursor('len([s for s in spans if s.span_kind == "TOOL"|])')
    ).toEqual({ iterableName: "spans", loopVariable: "s" });
  });

  it("resolves a nested collection to the iterable it names", () => {
    // `trace.spans` inside a trace comprehension exposes the same fields a
    // top-level `for span in spans` does.
    expect(
      detectScopeAtCursor(
        "any(any(span.| for span in trace.spans) for trace in traces)"
      )
    ).toEqual({ iterableName: "spans", loopVariable: "span" });
  });

  it("returns null wherever it cannot classify, so completion is unchanged", () => {
    // Outside any comprehension, mid-typed with no `for` clause yet, and over
    // a collection that isn't in the vocabulary.
    expect(detectScopeAtCursor("num_traces >= |")).toBeNull();
    expect(detectScopeAtCursor("any(s.|")).toBeNull();
    expect(detectScopeAtCursor("any(x.| for x in widgets)")).toBeNull();
  });
});

describe("DSL filter for-clause target detection", () => {
  it("detects the iterable slot of a `for` clause, typed or empty", () => {
    expect(
      detectDSLFilterForClauseTarget({
        textBeforeCursor: "any(s.latency_ms > 100 for s in ",
      })
    ).toEqual({ loopVariable: "s" });
    expect(
      detectDSLFilterForClauseTarget({
        textBeforeCursor:
          "any(cost_detail.cost > 1 for cost_detail in span_cost_",
      })
    ).toEqual({ loopVariable: "cost_detail" });
    expect(
      detectDSLFilterForClauseTarget({
        textBeforeCursor: "len([x for x in ",
      })
    ).toEqual({ loopVariable: "x" });
  });

  it("returns null outside the iterable slot", () => {
    // A fully-typed clause followed by an `if` predicate, a predicate
    // position, and a top-level expression are all not the iterable slot.
    expect(
      detectDSLFilterForClauseTarget({
        textBeforeCursor: "any(s.latency_ms for s in spans if s.",
      })
    ).toBeNull();
    expect(
      detectDSLFilterForClauseTarget({ textBeforeCursor: "any(s.lat" })
    ).toBeNull();
    expect(
      detectDSLFilterForClauseTarget({ textBeforeCursor: "num_traces in " })
    ).toBeNull();
  });
});

describe("DSL filter comprehension call detection", () => {
  it("detects the innermost enclosing quantifier or reduction call", () => {
    expect(
      detectDSLFilterComprehensionCall({ textBeforeCursor: "sum(" })
    ).toEqual({ functionName: "sum", isListForm: false });
    expect(
      detectDSLFilterComprehensionCall({ textBeforeCursor: "len([" })
    ).toEqual({ functionName: "len", isListForm: true });
    expect(
      detectDSLFilterComprehensionCall({
        textBeforeCursor: "num_traces > 2 and any(",
      })
    ).toEqual({ functionName: "any", isListForm: false });
  });

  it("returns null outside a comprehension call", () => {
    expect(
      detectDSLFilterComprehensionCall({ textBeforeCursor: "num_traces >= " })
    ).toBeNull();
    expect(
      detectDSLFilterComprehensionCall({
        textBeforeCursor: 'any(s.status_code == "ERROR" for s in spans) and ',
      })
    ).toBeNull();
    expect(
      detectDSLFilterComprehensionCall({
        textBeforeCursor: "annotations[",
      })
    ).toBeNull();
  });
});

describe("DSL filter comprehension range", () => {
  it("spans the comprehension an error should be anchored to", () => {
    const condition = 'num_traces > 2 and any(s.foo == "x" for s in spans)';
    const range = findDSLFilterComprehensionRange(condition);

    expect(range).not.toBeNull();
    expect(condition.slice(range!.from, range!.to)).toBe(
      'any(s.foo == "x" for s in spans)'
    );
  });

  it("returns null for a condition with no comprehension", () => {
    expect(findDSLFilterComprehensionRange("num_traces >= 5")).toBeNull();
  });
});

describe("DSL filter completion source", () => {
  it("gives the option builder both sides of the cursor", async () => {
    // A comprehension's `for` clause is commonly to the right of the cursor,
    // so the request has to carry it for scope detection to see it.
    const conditionWithCursor = "any(| for s in spans)";
    const cursorIndex = conditionWithCursor.indexOf("|");
    const doc =
      conditionWithCursor.slice(0, cursorIndex) +
      conditionWithCursor.slice(cursorIndex + 1);
    const context = {
      pos: cursorIndex,
      explicit: true,
      state: {
        doc: {
          sliceString: (from: number, to?: number) => doc.slice(from, to),
        },
      },
    } as unknown as CompletionContext;

    let request: DSLFilterCompletionRequest | null = null;
    const source = createDSLFilterCompletionSource((completionRequest) => {
      request = completionRequest;
      return [{ label: "s.latency_ms" }];
    });
    const result = (await source(context)) as CompletionResult;

    expect(result).not.toBeNull();
    expect(request).toEqual({
      isBrowsing: true,
      textBeforeCursor: "any(",
      textAfterCursor: " for s in spans)",
    });
  });
});
