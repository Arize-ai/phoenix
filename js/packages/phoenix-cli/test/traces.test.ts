import type { componentsV1 } from "@arizeai/phoenix-client";

import { buildTrace, groupSpansByTrace } from "../src/trace";

import { describe, expect, it } from "vitest";

type Span = componentsV1["schemas"]["Span"];

// Mock span data
const mockSpan1: Span = {
  name: "chat_completion",
  span_kind: "LLM",
  parent_id: null,
  status_code: "OK",
  status_message: "",
  start_time: "2026-01-13T10:00:00.000Z",
  end_time: "2026-01-13T10:00:01.200Z",
  attributes: {
    "llm.model_name": "gpt-4",
    "llm.provider": "openai",
    "llm.input_messages": [{ role: "user", content: "Hello" }],
    "llm.output_messages": [{ role: "assistant", content: "Hi there!" }],
    "llm.token_count.prompt": 10,
    "llm.token_count.completion": 15,
    "llm.token_count.total": 25,
  },
  events: [],
  context: {
    trace_id: "abc123",
    span_id: "span1",
  },
} as Span;

const mockSpan2: Span = {
  name: "tool_call",
  span_kind: "TOOL",
  parent_id: "span1",
  status_code: "OK",
  status_message: "",
  start_time: "2026-01-13T10:00:00.500Z",
  end_time: "2026-01-13T10:00:00.800Z",
  attributes: {
    "tool.name": "search",
    "tool.description": "Search the web",
  },
  events: [],
  context: {
    trace_id: "abc123",
    span_id: "span2",
  },
} as Span;

const mockErrorSpan: Span = {
  name: "failed_operation",
  span_kind: "UNKNOWN",
  parent_id: "span1",
  status_code: "ERROR",
  status_message: "Operation failed",
  start_time: "2026-01-13T10:00:01.000Z",
  end_time: "2026-01-13T10:00:01.100Z",
  attributes: {
    error: "true",
    "exception.type": "ValueError",
    "exception.message": "Invalid input",
    "exception.stacktrace": "ValueError: Invalid input\n  at line 1",
  },
  events: [],
  context: {
    trace_id: "abc123",
    span_id: "span3",
  },
} as Span;

describe("Trace Utilities", () => {
  describe("groupSpansByTrace", () => {
    it("should group spans by trace ID", () => {
      const span1 = {
        ...mockSpan1,
        context: { trace_id: "trace1", span_id: "span1" },
      };
      const span2 = {
        ...mockSpan2,
        context: { trace_id: "trace1", span_id: "span2" },
      };
      const span3 = {
        ...mockErrorSpan,
        context: { trace_id: "trace2", span_id: "span3" },
      };

      const grouped = groupSpansByTrace({ spans: [span1, span2, span3] });

      expect(grouped.size).toBe(2);
      expect(grouped.get("trace1")).toHaveLength(2);
      expect(grouped.get("trace2")).toHaveLength(1);
    });
  });

  describe("buildTrace", () => {
    it("should build a trace from spans", () => {
      const trace = buildTrace({
        spans: [mockSpan1, mockSpan2, mockErrorSpan],
      });

      expect(trace.traceId).toBe("abc123");
      expect(trace.spans).toHaveLength(3);
      expect(trace.rootSpan).toBe(mockSpan1);
      expect(trace.startTime).toBeDefined();
      expect(trace.endTime).toBeDefined();
      expect(trace.duration).toBeGreaterThan(0);
      expect(trace.status).toBe("ERROR"); // Has error span
    });

    it("should calculate correct timing", () => {
      const trace = buildTrace({ spans: [mockSpan1, mockSpan2] });

      expect(trace.duration).toBe(1200); // 1.2 seconds in ms
    });

    it("should throw error for empty spans", () => {
      expect(() => buildTrace({ spans: [] })).toThrow(
        "Cannot build trace from empty spans array"
      );
    });
  });
});
