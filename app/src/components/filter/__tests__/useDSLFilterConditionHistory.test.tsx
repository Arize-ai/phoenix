import type {
  CompletionContext,
  CompletionResult,
} from "@codemirror/autocomplete";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { installTestStorage } from "@phoenix/__tests__/installTestStorage";

import {
  DSL_FILTER_HISTORY_DWELL_MS,
  type DSLFilterConditionHistory,
  getDSLFilterConditionHistoryStorageKey,
  pushDSLFilterConditionHistory,
  readDSLFilterConditionHistory,
  useDSLFilterConditionHistory,
  type UseDSLFilterConditionHistoryProps,
} from "../useDSLFilterConditionHistory";

installTestStorage();

const HISTORY_KEY = "test-filter";
const STORAGE_KEY = getDSLFilterConditionHistoryStorageKey(HISTORY_KEY);

describe("readDSLFilterConditionHistory", () => {
  it("returns an empty history when nothing is stored", () => {
    expect(readDSLFilterConditionHistory(STORAGE_KEY)).toEqual([]);
  });

  it("tolerates malformed and foreign stored values", () => {
    localStorage.setItem(STORAGE_KEY, "not json");
    expect(readDSLFilterConditionHistory(STORAGE_KEY)).toEqual([]);

    localStorage.setItem(STORAGE_KEY, JSON.stringify({ nope: true }));
    expect(readDSLFilterConditionHistory(STORAGE_KEY)).toEqual([]);

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(["latency_ms > 100", 42, null])
    );
    expect(readDSLFilterConditionHistory(STORAGE_KEY)).toEqual([
      "latency_ms > 100",
    ]);
  });
});

describe("pushDSLFilterConditionHistory", () => {
  it("adds the newest condition first", () => {
    expect(pushDSLFilterConditionHistory(["a"], "b", 5)).toEqual(["b", "a"]);
  });

  it("moves a repeated condition to the front instead of duplicating it", () => {
    expect(pushDSLFilterConditionHistory(["a", "b", "c"], "b", 5)).toEqual([
      "b",
      "a",
      "c",
    ]);
  });

  it("drops the oldest entries beyond the capacity", () => {
    expect(pushDSLFilterConditionHistory(["a", "b", "c"], "d", 3)).toEqual([
      "d",
      "a",
      "b",
    ]);
  });
});

describe("useDSLFilterConditionHistory", () => {
  let root: Root | null = null;
  let history: DSLFilterConditionHistory;

  function Harness(props: UseDSLFilterConditionHistoryProps) {
    history = useDSLFilterConditionHistory(props);
    return null;
  }

  function mountHarness(
    props: UseDSLFilterConditionHistoryProps = { historyKey: HISTORY_KEY }
  ) {
    root = createRoot(document.createElement("div"));
    act(() => {
      root?.render(<Harness {...props} />);
    });
  }

  function unmountHarness() {
    act(() => {
      root?.unmount();
    });
    root = null;
  }

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    if (root) {
      unmountHarness();
    }
    vi.useRealTimers();
  });

  it("commits a condition once it has stayed applied for the dwell", () => {
    mountHarness();
    history.recordValidCondition("status_code == 'ERROR'");

    vi.advanceTimersByTime(DSL_FILTER_HISTORY_DWELL_MS - 1);
    expect(readDSLFilterConditionHistory(STORAGE_KEY)).toEqual([]);

    vi.advanceTimersByTime(1);
    expect(readDSLFilterConditionHistory(STORAGE_KEY)).toEqual([
      "status_code == 'ERROR'",
    ]);
  });

  it("collapses intermediate conditions hit while typing", () => {
    mountHarness();
    history.recordValidCondition("latency_ms > 1");
    vi.advanceTimersByTime(DSL_FILTER_HISTORY_DWELL_MS - 1);
    history.recordValidCondition("latency_ms > 1000");

    vi.advanceTimersByTime(DSL_FILTER_HISTORY_DWELL_MS);
    expect(readDSLFilterConditionHistory(STORAGE_KEY)).toEqual([
      "latency_ms > 1000",
    ]);
  });

  it("discards a pending condition when the field is cleared", () => {
    mountHarness();
    history.recordValidCondition("latency_ms > 1");
    history.recordValidCondition("");

    vi.advanceTimersByTime(DSL_FILTER_HISTORY_DWELL_MS);
    expect(readDSLFilterConditionHistory(STORAGE_KEY)).toEqual([]);
  });

  it("flushes a pending condition on unmount", () => {
    mountHarness();
    history.recordValidCondition("span_kind == 'LLM'");
    unmountHarness();

    expect(readDSLFilterConditionHistory(STORAGE_KEY)).toEqual([
      "span_kind == 'LLM'",
    ]);
  });

  it("keeps histories separate per history key", () => {
    mountHarness({ historyKey: "project-a" });
    history.recordValidCondition("latency_ms > 100");
    unmountHarness();

    mountHarness({ historyKey: "project-b" });
    history.recordValidCondition("status_code == 'ERROR'");
    unmountHarness();

    expect(
      readDSLFilterConditionHistory(
        getDSLFilterConditionHistoryStorageKey("project-a")
      )
    ).toEqual(["latency_ms > 100"]);
    expect(
      readDSLFilterConditionHistory(
        getDSLFilterConditionHistoryStorageKey("project-b")
      )
    ).toEqual(["status_code == 'ERROR'"]);
  });

  it("serves recent searches through the completion source in recency order", async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(["latency_ms > 100", "status_code == 'ERROR'"])
    );
    mountHarness();

    // A browsing context: the empty field was focused, opening the dropdown
    const context = {
      pos: 0,
      explicit: true,
      state: { doc: { sliceString: () => "" } },
    } as unknown as CompletionContext;
    const result = (await history.completionSource(
      context
    )) as CompletionResult;

    expect(result.options.map((option) => option.label)).toEqual([
      "latency_ms > 100",
      "status_code == 'ERROR'",
    ]);
    // Newer entries are boosted so CodeMirror preserves recency order
    expect(result.options[0]?.boost).toBeGreaterThan(
      result.options[1]?.boost ?? 0
    );
    expect(
      result.options.every(
        (option) => option.section === result.options[0]?.section
      )
    ).toBe(true);
  });

  it("replaces the entire field contents when a recent search is accepted", async () => {
    const condition = "latency_ms > 1000";
    localStorage.setItem(STORAGE_KEY, JSON.stringify([condition]));
    mountHarness();

    // The field already holds a partial expression; the recent surfaced at
    // the trailing token must not be spliced in at that token
    const typed = "latency_ms > ";
    const context = {
      pos: typed.length,
      explicit: true,
      state: { doc: { sliceString: () => typed } },
    } as unknown as CompletionContext;
    const result = (await history.completionSource(
      context
    )) as CompletionResult;

    const option = result.options[0];
    const apply = option?.apply;
    if (!option || typeof apply !== "function") {
      throw new Error("expected recent search to have a custom apply");
    }
    const dispatch = vi.fn();
    const view = {
      state: { doc: { length: typed.length } },
      dispatch,
    } as unknown as Parameters<typeof apply>[0];
    apply(view, option, 0, typed.length);

    expect(dispatch).toHaveBeenCalledExactlyOnceWith({
      changes: { from: 0, to: typed.length, insert: condition },
      selection: { anchor: condition.length },
      userEvent: "input.complete",
    });
  });
});
