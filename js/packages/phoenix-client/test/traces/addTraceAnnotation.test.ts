import { beforeEach, describe, expect, it, vi } from "vitest";

import { addTraceAnnotation } from "../../src/traces/addTraceAnnotation";

const mockPOST = vi.fn();

vi.mock("openapi-fetch", () => ({
  default: () => ({
    POST: mockPOST.mockResolvedValue({
      data: {
        data: [{ id: "test-id-1" }],
      },
      error: null,
    }),
    use: () => {},
  }),
}));

describe("addTraceAnnotation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPOST.mockResolvedValue({
      data: {
        data: [{ id: "test-id-1" }],
      },
      error: null,
    });
  });

  it("should add a trace annotation with all fields", async () => {
    const result = await addTraceAnnotation({
      traceAnnotation: {
        traceId: "abc123",
        name: "correctness",
        label: "correct",
        score: 1.0,
        annotatorKind: "HUMAN",
        identifier: "test-identifier",
        metadata: { reviewer: "alice" },
      },
      sync: true,
    });

    expect(result).toEqual({ id: "test-id-1" });
    expect(mockPOST).toHaveBeenCalledWith("/v1/trace_annotations", {
      params: { query: { sync: true } },
      body: {
        data: [
          {
            trace_id: "abc123",
            name: "correctness",
            annotator_kind: "HUMAN",
            result: { label: "correct", score: 1.0 },
            metadata: { reviewer: "alice" },
            identifier: "test-identifier",
          },
        ],
      },
    });
  });

  it("should add a trace annotation with explanation only", async () => {
    const result = await addTraceAnnotation({
      traceAnnotation: {
        traceId: "abc123",
        name: "correctness",
        explanation: "Looks correct end-to-end",
        annotatorKind: "LLM",
      },
      sync: true,
    });

    expect(result).toEqual({ id: "test-id-1" });
  });

  it("should return null when sync=false (default)", async () => {
    mockPOST.mockResolvedValueOnce({
      data: undefined,
      error: undefined,
    });

    const result = await addTraceAnnotation({
      traceAnnotation: {
        traceId: "abc123",
        name: "correctness",
        label: "correct",
      },
    });

    expect(result).toBeNull();
  });

  it("should throw when no result fields are provided", async () => {
    await expect(
      addTraceAnnotation({
        traceAnnotation: {
          traceId: "abc123",
          name: "correctness",
        },
      })
    ).rejects.toThrow(
      "At least one of label, score, or explanation must be provided for trace annotation"
    );
  });

  it("should reject the reserved name 'note'", async () => {
    await expect(
      addTraceAnnotation({
        traceAnnotation: {
          traceId: "abc123",
          name: "note",
          label: "anything",
        },
      })
    ).rejects.toThrow(/reserved for trace and span notes/);
  });
});
