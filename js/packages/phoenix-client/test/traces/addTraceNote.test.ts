import { beforeEach, describe, expect, it, vi } from "vitest";

import { addTraceNote } from "../../src/traces/addTraceNote";

const mockPOST = vi.fn();

vi.mock("openapi-fetch", () => ({
  default: () => ({
    POST: mockPOST.mockResolvedValue({
      data: {
        data: { id: "test-trace-note-id-1" },
      },
      error: null,
    }),
    use: () => {},
  }),
}));

describe("addTraceNote", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPOST.mockResolvedValue({
      data: {
        data: { id: "test-trace-note-id-1" },
      },
      error: null,
    });
  });

  it("should add a trace note", async () => {
    const result = await addTraceNote({
      traceNote: {
        traceId: "trace123",
        note: "This is a trace note",
      },
    });

    expect(result).toEqual({ id: "test-trace-note-id-1" });
  });

  it("should trim trace ID", async () => {
    await addTraceNote({
      traceNote: {
        traceId: "  trace123  ",
        note: "This is a trace note",
      },
    });

    expect(mockPOST).toHaveBeenCalledWith("/v1/trace_notes", {
      body: {
        data: {
          trace_id: "trace123",
          note: "This is a trace note",
        },
      },
    });
  });

  it("should throw error when API returns error", async () => {
    mockPOST.mockResolvedValueOnce({
      data: undefined,
      error: "Trace not found",
    });

    await expect(
      addTraceNote({
        traceNote: {
          traceId: "missing-trace",
          note: "This will fail",
        },
      })
    ).rejects.toThrow("Failed to add trace note: Trace not found");
  });

  it("should throw error when no data is returned", async () => {
    mockPOST.mockResolvedValueOnce({
      data: undefined,
      error: undefined,
    });

    await expect(
      addTraceNote({
        traceNote: {
          traceId: "trace123",
          note: "This will fail",
        },
      })
    ).rejects.toThrow("Failed to add trace note: no data returned");
  });
});
