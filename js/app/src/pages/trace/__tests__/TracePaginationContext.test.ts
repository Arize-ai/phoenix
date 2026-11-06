import { describe, expect, it } from "vitest";

import { makeTraceUrls } from "../TracePaginationContext";

describe("makeTraceUrls", () => {
  it("preserves recreatable URL state while replacing selected span", () => {
    const location = {
      pathname: "/projects/project-1/spans/current-trace",
      search:
        "?timeRangeStart=2026-06-09T09%3A00%3A00.000Z&timeRangeEnd=2026-06-09T10%3A00%3A00.000Z&selectedSpanNodeId=current-span",
      hash: "#details",
    } as Parameters<typeof makeTraceUrls>[0];

    const traceSequence = [
      { traceId: "current-trace", spanId: "current-span" },
      { traceId: "next-trace", spanId: "next-span" },
    ];

    expect(
      makeTraceUrls(location, traceSequence, "current-span").nextTracePath
    ).toBe(
      "/projects/project-1/spans/next-trace?timeRangeStart=2026-06-09T09%3A00%3A00.000Z&timeRangeEnd=2026-06-09T10%3A00%3A00.000Z&selectedSpanNodeId=next-span#details"
    );
  });

  it("adds the selected span when there is no other search state to preserve", () => {
    const location = {
      pathname: "/projects/project-1/traces/current-trace",
      search: "",
      hash: "",
    } as Parameters<typeof makeTraceUrls>[0];

    const traceSequence = [
      { traceId: "previous-trace", spanId: "previous-span" },
      { traceId: "current-trace", spanId: "current-span" },
    ];

    expect(
      makeTraceUrls(location, traceSequence, "current-trace").previousTracePath
    ).toBe(
      "/projects/project-1/traces/previous-trace?selectedSpanNodeId=previous-span"
    );
  });
});
