import { formatProjectsOutput } from "../src/commands/formatProjects";
import {
  formatTraceOutput,
  formatTracesOutput,
} from "../src/commands/formatTraces";
import type { Trace } from "../src/trace";

import { describe, expect, it } from "vitest";

type MockSpan = Trace["spans"][number];

// Mock spans
const mockSpan1: MockSpan = {
  name: "chat_completion",
  span_kind: "LLM",
  parent_id: null,
  status_code: "OK",
  status_message: "",
  start_time: "2026-01-13T10:00:00.000Z",
  end_time: "2026-01-13T10:00:01.200Z",
  attributes: {
    "llm.model_name": "gpt-4",
    "input.value": "Hello",
    "output.value": "Hi there!",
  },
  events: [],
  context: {
    trace_id: "abc123def456",
    span_id: "span1",
  },
} as unknown as MockSpan;

const mockSpan2: MockSpan = {
  name: "tool_call",
  span_kind: "TOOL",
  parent_id: "span1",
  status_code: "OK",
  status_message: "",
  start_time: "2026-01-13T10:00:00.500Z",
  end_time: "2026-01-13T10:00:00.800Z",
  attributes: {
    "tool.name": "search",
    "input.value": "child input should not render",
    "output.value": "child output should not render",
  },
  events: [],
  context: {
    trace_id: "abc123def456",
    span_id: "span2",
  },
} as unknown as MockSpan;

const mockErrorSpan: MockSpan = {
  name: "failed_operation",
  span_kind: "UNKNOWN",
  parent_id: null,
  status_code: "ERROR",
  status_message: "Operation failed",
  start_time: "2026-01-13T10:00:01.000Z",
  end_time: "2026-01-13T10:00:01.100Z",
  attributes: {
    error: "true",
  },
  events: [],
  context: {
    trace_id: "error123",
    span_id: "span3",
  },
} as unknown as MockSpan;

// Mock trace reflection
const mockTraceReflection: Trace = {
  traceId: "abc123def456",
  spans: [mockSpan1, mockSpan2],
};

const mockTraceWithError: Trace = {
  traceId: "error123",
  spans: [mockErrorSpan],
};

describe("Output Formatting", () => {
  describe("trace output - raw", () => {
    it("should format as compact JSON", () => {
      const output = formatTraceOutput({
        trace: mockTraceReflection,
        format: "raw",
      });

      expect(output).toBe(JSON.stringify(mockTraceReflection));
      expect(output).not.toContain("\n");
    });

    it("should handle arrays", () => {
      const output = formatTracesOutput({
        traces: [mockTraceReflection],
        format: "raw",
      });

      expect(output).toBe(JSON.stringify([mockTraceReflection]));
    });
  });

  describe("trace output - json", () => {
    it("should format as pretty JSON", () => {
      const output = formatTraceOutput({
        trace: mockTraceReflection,
        format: "json",
      });

      expect(output).toBe(JSON.stringify(mockTraceReflection, null, 2));
      expect(output).toContain("\n");
      expect(output).toContain("  ");
    });

    it("should handle arrays", () => {
      const output = formatTracesOutput({
        traces: [mockTraceReflection],
        format: "json",
      });

      expect(output).toBe(JSON.stringify([mockTraceReflection], null, 2));
    });
  });

  describe("trace output - pretty", () => {
    it("should format single trace reflection in human-readable format", () => {
      const output = formatTraceOutput({
        trace: mockTraceReflection,
        format: "pretty",
      });

      expect(output).toContain("┌─ Trace: abc123def456");
      expect(output).toContain("│  Input: Hello");
      expect(output).toContain("│  Output: Hi there!");
      expect(output).toContain("│  Spans:");
      expect(output).toContain("└─ ✓ chat_completion (LLM) - 1200ms");
      expect(output).toContain("└─ ✓ tool_call (TOOL) - 300ms");
      expect(output).not.toContain("child input should not render");
      expect(output).not.toContain("child output should not render");
      expect(output).toContain("└─");
    });

    it("should format trace with errors", () => {
      const output = formatTraceOutput({
        trace: mockTraceWithError,
        format: "pretty",
      });

      expect(output).toContain("✗ failed_operation (UNKNOWN) - 100ms");
    });

    it("should format array of traces", () => {
      const output = formatTracesOutput({
        traces: [mockTraceReflection, mockTraceWithError],
        format: "pretty",
      });

      expect(output).toContain("┌─ Trace: abc123def456");
      expect(output).toContain("┌─ Trace: error123");
      expect(output).toContain("=".repeat(80));
    });

    it("should handle empty array", () => {
      const output = formatTracesOutput({ traces: [], format: "pretty" });

      expect(output).toBe("No traces found");
    });

    it("should truncate long input/output values", () => {
      const longValue = "a".repeat(250);
      const trace: Trace = {
        traceId: "truncate123",
        spans: [
          {
            ...mockSpan1,
            context: { ...mockSpan1.context, trace_id: "truncate123" },
            attributes: {
              ...mockSpan1.attributes,
              "input.value": longValue,
            },
          } as unknown as MockSpan,
        ],
      };

      const output = formatTraceOutput({ trace, format: "pretty" });
      expect(output).toContain(`│  Input: ${"a".repeat(200)}…`);
    });

    it("should format projects list in human-readable format", () => {
      const projects = [
        { name: "default", description: "Default project", id: "UHJvamVjdDox" },
        { name: "SESSIONS-DEMO", description: null, id: "UHJvamVjdDo1" },
      ];

      const output = formatProjectsOutput({ projects, format: "pretty" });

      expect(output).toContain("Projects:");
      expect(output).toContain("- default (UHJvamVjdDox) — Default project");
      expect(output).toContain("- SESSIONS-DEMO (UHJvamVjdDo1)");
      expect(output).not.toContain("[");
      expect(output).not.toContain("{");
    });
  });
});
