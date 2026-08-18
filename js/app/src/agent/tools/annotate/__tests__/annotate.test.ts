import { beforeEach, describe, expect, it, vi } from "vitest";

const relayMocks = vi.hoisted(() => ({
  commitMutation: vi.fn(),
  fetchQuery: vi.fn(),
  graphql: vi.fn((strings: TemplateStringsArray) => strings.join("")),
}));

vi.mock("react-relay", () => ({
  commitMutation: relayMocks.commitMutation,
  fetchQuery: relayMocks.fetchQuery,
  graphql: relayMocks.graphql,
}));

vi.mock("@phoenix/RelayEnvironment", () => ({ default: {} }));

const applySpanAnnotations = vi.hoisted(() => vi.fn());

vi.mock("@phoenix/agent/tools/batchSpanAnnotate", () => ({
  applySpanAnnotations,
}));

import {
  applyAnnotation,
  parseAnnotateInput,
} from "@phoenix/agent/tools/annotate";

function getValidSpanNodeId(rowId: string): string {
  return globalThis.btoa(`Span:${rowId}`);
}

function getValidTraceNodeId(rowId: string): string {
  return globalThis.btoa(`Trace:${rowId}`);
}

function getValidSessionNodeId(rowId: string): string {
  return globalThis.btoa(`ProjectSession:${rowId}`);
}

function getParsed(input: unknown) {
  const parsed = parseAnnotateInput(input);
  expect(parsed).not.toBeNull();
  return parsed!;
}

function mockSuccessfulCommit() {
  relayMocks.commitMutation.mockImplementation(
    (
      _environment: unknown,
      config: {
        onCompleted: (
          response: unknown,
          errors?: readonly { message?: string }[] | null
        ) => void;
      }
    ) => {
      config.onCompleted({}, null);
    }
  );
}

describe("annotate parsing", () => {
  it("accepts a span, trace, or session target and fills defaults", () => {
    expect(
      getParsed({
        spanId: "ABCDEF0123456789",
        name: "  Quality  ",
        label: "good",
      })
    ).toEqual(
      expect.objectContaining({
        target: "span",
        spanId: "abcdef0123456789",
        name: "Quality",
        annotatorKind: "LLM",
      })
    );
    expect(
      getParsed({
        traceId: "0123456789abcdef0123456789abcdef",
        name: "task_success",
        score: 1,
      })
    ).toEqual(
      expect.objectContaining({
        target: "trace",
        traceId: "0123456789abcdef0123456789abcdef",
        score: 1,
      })
    );
    expect(
      getParsed({
        sessionId: "chat-42",
        name: "user_satisfaction",
        explanation: "User reached the goal.",
      })
    ).toEqual(
      expect.objectContaining({
        target: "session",
        sessionId: "chat-42",
        explanation: "User reached the goal.",
      })
    );
  });

  it("rejects missing values, reserved names, and multiple targets", () => {
    expect(
      parseAnnotateInput({
        spanId: "abcdef0123456789",
        name: "quality",
      })
    ).toBeNull();
    expect(
      parseAnnotateInput({
        spanId: "abcdef0123456789",
        name: "note",
        label: "good",
      })
    ).toBeNull();
    expect(
      parseAnnotateInput({
        spanId: "abcdef0123456789",
        traceId: "0123456789abcdef0123456789abcdef",
        name: "quality",
        label: "good",
      })
    ).toBeNull();
    expect(
      parseAnnotateInput({
        name: "quality",
        label: "good",
      })
    ).toBeNull();
  });

  it("rejects a GraphQL session node ID in sessionId", () => {
    expect(
      parseAnnotateInput({
        sessionId: getValidSessionNodeId("1"),
        name: "quality",
        label: "good",
      })
    ).toBeNull();
  });
});

describe("applyAnnotation", () => {
  beforeEach(() => {
    relayMocks.commitMutation.mockReset();
    relayMocks.fetchQuery.mockReset();
    applySpanAnnotations.mockReset();
    applySpanAnnotations.mockResolvedValue(undefined);
    mockSuccessfulCommit();
  });

  it("delegates span annotations to applySpanAnnotations", async () => {
    const annotation = getParsed({
      spanNodeId: getValidSpanNodeId("1"),
      name: "quality",
      label: "good",
    });

    const result = await applyAnnotation(annotation);

    expect(result).toEqual({
      ok: true,
      output: 'Applied span annotation "quality: good".',
    });
    expect(applySpanAnnotations).toHaveBeenCalledWith([
      expect.objectContaining({
        spanNodeId: getValidSpanNodeId("1"),
        name: "quality",
        label: "good",
      }),
    ]);
    expect(relayMocks.commitMutation).not.toHaveBeenCalled();
  });

  it("resolves a trace by OpenTelemetry ID then creates a trace annotation", async () => {
    const traceNodeId = getValidTraceNodeId("9");
    relayMocks.fetchQuery.mockImplementation(
      (
        _environment: unknown,
        _query: unknown,
        variables: { traceId?: string }
      ) => ({
        toPromise: () =>
          Promise.resolve({
            trace: variables.traceId ? { id: traceNodeId } : null,
          }),
      })
    );
    const annotation = getParsed({
      traceId: "0123456789abcdef0123456789abcdef",
      name: "task_success",
      label: "pass",
    });

    const result = await applyAnnotation(annotation);

    expect(result.ok).toBe(true);
    expect(relayMocks.commitMutation).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        variables: expect.objectContaining({
          traceId: traceNodeId,
          input: [
            expect.objectContaining({
              traceId: traceNodeId,
              name: "task_success",
              label: "pass",
              source: "APP",
            }),
          ],
        }),
      })
    );
  });

  it("resolves a session by session ID then creates a session annotation", async () => {
    const sessionNodeId = getValidSessionNodeId("3");
    relayMocks.fetchQuery.mockImplementation(() => ({
      toPromise: () =>
        Promise.resolve({
          session: { id: sessionNodeId },
        }),
    }));
    const annotation = getParsed({
      sessionId: "chat-42",
      name: "user_satisfaction",
      score: 0.9,
    });

    const result = await applyAnnotation(annotation);

    expect(result.ok).toBe(true);
    expect(relayMocks.commitMutation).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        variables: expect.objectContaining({
          sessionId: sessionNodeId,
          input: expect.objectContaining({
            projectSessionId: sessionNodeId,
            name: "user_satisfaction",
            score: 0.9,
            source: "APP",
          }),
        }),
      })
    );
  });

  it("does not commit when the trace target cannot be resolved", async () => {
    relayMocks.fetchQuery.mockImplementation(() => ({
      toPromise: () => Promise.resolve({ trace: null }),
    }));
    const annotation = getParsed({
      traceId: "0123456789abcdef0123456789abcdef",
      name: "task_success",
      label: "fail",
    });

    const result = await applyAnnotation(annotation);

    expect(result).toEqual({
      ok: false,
      error: "Could not resolve traceId to a trace.",
    });
    expect(relayMocks.commitMutation).not.toHaveBeenCalled();
  });
});
