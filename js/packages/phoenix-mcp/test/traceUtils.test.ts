import type { componentsV1 } from "@arizeai/phoenix-client";
import { describe, expect, it } from "vitest";

import { buildTrace, groupSpansByTrace } from "../src/traceUtils";

type Span = componentsV1["schemas"]["Span"];

const rootSpan: Span = {
  name: "root",
  span_kind: "CHAIN",
  parent_id: null,
  status_code: "OK",
  status_message: "",
  start_time: "2026-03-20T00:00:00.000Z",
  end_time: "2026-03-20T00:00:02.000Z",
  attributes: {},
  events: [],
  context: {
    trace_id: "trace-1",
    span_id: "span-1",
  },
} as Span;

const childSpan: Span = {
  name: "child",
  span_kind: "LLM",
  parent_id: "span-1",
  status_code: "ERROR",
  status_message: "boom",
  start_time: "2026-03-20T00:00:01.000Z",
  end_time: "2026-03-20T00:00:03.000Z",
  attributes: {},
  events: [],
  context: {
    trace_id: "trace-1",
    span_id: "span-2",
  },
} as Span;

describe("groupSpansByTrace", () => {
  it("groups spans by trace ID", () => {
    const grouped = groupSpansByTrace({
      spans: [rootSpan, childSpan],
    });

    expect(grouped.size).toBe(1);
    expect(grouped.get("trace-1")).toHaveLength(2);
  });
});

describe("buildTrace", () => {
  it("builds a trace summary with status and duration", () => {
    const trace = buildTrace({
      spans: [rootSpan, childSpan],
    });

    expect(trace.traceId).toBe("trace-1");
    expect(trace.rootSpan).toBe(rootSpan);
    expect(trace.duration).toBe(3000);
    expect(trace.status).toBe("ERROR");
  });
});
