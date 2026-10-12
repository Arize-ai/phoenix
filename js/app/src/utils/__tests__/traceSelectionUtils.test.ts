import { describe, expect, it } from "vitest";

import {
  getComparableTraceSlots,
  getCompareTracesPath,
  getTraceSelectionSlots,
  isSpanRowSelected,
  parseCompareTraceSlots,
  setCompareTraceSlotSelection,
} from "../traceSelectionUtils";

describe("parseCompareTraceSlots", () => {
  it("pairs each trace with the selected span at the same position", () => {
    expect(
      parseCompareTraceSlots(
        "?traceId=a&traceId=b&selectedSpanNodeId=span-a&selectedSpanNodeId=span-b"
      )
    ).toEqual([
      { traceId: "a", selectedSpanNodeId: "span-a" },
      { traceId: "b", selectedSpanNodeId: "span-b" },
    ]);
  });

  it("treats missing and empty span positions as no selection", () => {
    expect(
      parseCompareTraceSlots(
        new URLSearchParams(
          "traceId=a&traceId=b&selectedSpanNodeId=&selectedSpanNodeId=span-b"
        )
      )
    ).toEqual([
      { traceId: "a", selectedSpanNodeId: null },
      { traceId: "b", selectedSpanNodeId: "span-b" },
    ]);
    expect(parseCompareTraceSlots("?traceId=a&traceId=b")).toEqual([
      { traceId: "a", selectedSpanNodeId: null },
      { traceId: "b", selectedSpanNodeId: null },
    ]);
  });

  it("drops a blank trace without shifting the later spans", () => {
    expect(
      parseCompareTraceSlots(
        "?traceId=&traceId=b&selectedSpanNodeId=&selectedSpanNodeId=span-b"
      )
    ).toEqual([{ traceId: "b", selectedSpanNodeId: "span-b" }]);
  });

  it("returns no slots when there are no traces", () => {
    expect(parseCompareTraceSlots("?selectedSpanNodeId=span-a")).toEqual([]);
  });
});

describe("getTraceSelectionSlots", () => {
  it("prefers the trace of the route with its selected span", () => {
    expect(
      getTraceSelectionSlots({
        routeTraceId: "route-trace",
        searchParams: new URLSearchParams("selectedSpanNodeId=span-1"),
      })
    ).toEqual([{ traceId: "route-trace", selectedSpanNodeId: "span-1" }]);
    expect(
      getTraceSelectionSlots({
        routeTraceId: "route-trace",
        searchParams: new URLSearchParams(),
      })
    ).toEqual([{ traceId: "route-trace", selectedSpanNodeId: null }]);
  });

  it("falls back to the compared traces when not on a trace route", () => {
    expect(
      getTraceSelectionSlots({
        searchParams: new URLSearchParams(
          "traceId=a&traceId=b&selectedSpanNodeId=span-a"
        ),
      })
    ).toEqual([
      { traceId: "a", selectedSpanNodeId: "span-a" },
      { traceId: "b", selectedSpanNodeId: null },
    ]);
  });
});

describe("getCompareTracesPath", () => {
  it("preserves recreatable state and replaces selection-scoped state", () => {
    const searchParams = new URLSearchParams(
      "timeRangeStart=2026-06-09T09%3A00%3A00.000Z&selectedSpanNodeId=old&selectedTraceId=old-trace"
    );
    expect(
      getCompareTracesPath({
        slots: [
          { traceId: "a", selectedSpanNodeId: "span-a" },
          { traceId: "b", selectedSpanNodeId: "span-b" },
        ],
        searchParams,
      })
    ).toBe(
      "compare?timeRangeStart=2026-06-09T09%3A00%3A00.000Z&traceId=a&traceId=b&selectedSpanNodeId=span-a&selectedSpanNodeId=span-b"
    );
    // the input is not mutated
    expect(searchParams.get("selectedSpanNodeId")).toBe("old");
  });

  it("omits the selected span params when nothing is selected", () => {
    expect(
      getCompareTracesPath({
        slots: [
          { traceId: "a", selectedSpanNodeId: null },
          { traceId: "b", selectedSpanNodeId: null },
        ],
        searchParams: new URLSearchParams(),
      })
    ).toBe("compare?traceId=a&traceId=b");
  });

  it("writes a placeholder so a later selection keeps its position", () => {
    expect(
      getCompareTracesPath({
        slots: [
          { traceId: "a", selectedSpanNodeId: null },
          { traceId: "b", selectedSpanNodeId: "span-b" },
        ],
        searchParams: new URLSearchParams(),
      })
    ).toBe(
      "compare?traceId=a&traceId=b&selectedSpanNodeId=&selectedSpanNodeId=span-b"
    );
  });
});

describe("setCompareTraceSlotSelection", () => {
  it("changes one trace's selected span and leaves the other alone", () => {
    const params = new URLSearchParams(
      "traceId=a&traceId=b&selectedSpanNodeId=span-a&selectedSpanNodeId=span-b"
    );
    setCompareTraceSlotSelection(params, 1, "span-b2");
    expect(params.toString()).toBe(
      "traceId=a&traceId=b&selectedSpanNodeId=span-a&selectedSpanNodeId=span-b2"
    );
  });

  it("writes a placeholder when only the second trace has a selection", () => {
    const params = new URLSearchParams("traceId=a&traceId=b");
    setCompareTraceSlotSelection(params, 1, "span-b");
    expect(params.toString()).toBe(
      "traceId=a&traceId=b&selectedSpanNodeId=&selectedSpanNodeId=span-b"
    );
  });
});

describe("isSpanRowSelected", () => {
  const slots = [
    { traceId: "a", selectedSpanNodeId: "span-a" },
    { traceId: "b", selectedSpanNodeId: null },
  ];
  it("matches the selected span of a trace with a selection", () => {
    expect(
      isSpanRowSelected(slots, { id: "span-a", trace: { traceId: "a" } })
    ).toBe(true);
    expect(
      isSpanRowSelected(slots, { id: "span-a-other", trace: { traceId: "a" } })
    ).toBe(false);
  });
  it("matches any span of a trace without a selection", () => {
    expect(
      isSpanRowSelected(slots, { id: "span-b-root", trace: { traceId: "b" } })
    ).toBe(true);
  });
  it("does not match spans of other traces", () => {
    expect(
      isSpanRowSelected(slots, { id: "span-c", trace: { traceId: "c" } })
    ).toBe(false);
  });
});

describe("getComparableTraceSlots", () => {
  it("compares two spans from two different traces", () => {
    expect(
      getComparableTraceSlots([
        { id: "span-a", trace: { traceId: "a" } },
        { id: "span-b", trace: { traceId: "b" } },
      ])
    ).toEqual([
      { traceId: "a", selectedSpanNodeId: "span-a" },
      { traceId: "b", selectedSpanNodeId: "span-b" },
    ]);
  });
  it("rejects two spans from the same trace", () => {
    expect(
      getComparableTraceSlots([
        { id: "span-a", trace: { traceId: "a" } },
        { id: "span-a2", trace: { traceId: "a" } },
      ])
    ).toBeNull();
  });
  it("rejects anything other than two spans", () => {
    expect(
      getComparableTraceSlots([{ id: "span-a", trace: { traceId: "a" } }])
    ).toBeNull();
    expect(
      getComparableTraceSlots([
        { id: "span-a", trace: { traceId: "a" } },
        { id: "span-b", trace: { traceId: "b" } },
        { id: "span-c", trace: { traceId: "c" } },
      ])
    ).toBeNull();
  });
});
