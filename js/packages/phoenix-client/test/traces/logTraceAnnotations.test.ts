import { beforeEach, describe, expect, it, vi } from "vitest";

import { logTraceAnnotations } from "../../src/traces/logTraceAnnotations";

const mockPOST = vi.fn();

vi.mock("openapi-fetch", () => ({
  default: () => ({
    POST: mockPOST.mockResolvedValue({
      data: {
        data: [{ id: "test-id-1" }, { id: "test-id-2" }],
      },
      error: null,
    }),
    use: () => {},
  }),
}));

describe("logTraceAnnotations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPOST.mockResolvedValue({
      data: {
        data: [{ id: "test-id-1" }, { id: "test-id-2" }],
      },
      error: null,
    });
  });

  it("should log multiple trace annotations", async () => {
    const result = await logTraceAnnotations({
      traceAnnotations: [
        {
          traceId: "abc123",
          name: "correctness",
          label: "correct",
          score: 1.0,
          annotatorKind: "HUMAN",
        },
        {
          traceId: "def456",
          name: "faithfulness",
          label: "faithful",
          score: 0.9,
          annotatorKind: "LLM",
        },
      ],
      sync: true,
    });

    expect(result).toEqual([{ id: "test-id-1" }, { id: "test-id-2" }]);
  });

  it("should return empty array when sync=false (default)", async () => {
    mockPOST.mockResolvedValueOnce({
      data: undefined,
      error: undefined,
    });

    const result = await logTraceAnnotations({
      traceAnnotations: [
        {
          traceId: "abc123",
          name: "correctness",
          label: "correct",
        },
      ],
    });

    expect(result).toEqual([]);
  });

  it("should throw when an annotation has no result fields", async () => {
    await expect(
      logTraceAnnotations({
        traceAnnotations: [
          {
            traceId: "abc123",
            name: "correctness",
            label: "correct",
          },
          {
            traceId: "def456",
            name: "faithfulness",
          },
        ],
      })
    ).rejects.toThrow(
      "At least one of label, score, or explanation must be provided for trace annotation"
    );
  });
});
