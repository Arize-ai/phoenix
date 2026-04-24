import { beforeEach, describe, expect, it, vi } from "vitest";

vi.unmock("../../src/utils/serverVersionUtils");

import { addTraceNote } from "../../src/traces/addTraceNote";

const mockPOST = vi.fn();

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

  function makeClient() {
    return {
      getServerVersion: async () => [14, 13, 0] as [number, number, number],
      POST: mockPOST,
    };
  }

  it("adds a trace note", async () => {
    const result = await addTraceNote({
      client: makeClient() as never,
      traceNote: {
        traceId: "trace123",
        note: "This is a trace note",
      },
    });

    expect(result).toEqual({ id: "test-trace-note-id-1" });
  });

  it("trims the trace ID", async () => {
    await addTraceNote({
      client: makeClient() as never,
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

  it("throws when the API returns an error", async () => {
    mockPOST.mockResolvedValueOnce({
      data: undefined,
      error: "Trace not found",
    });

    await expect(
      addTraceNote({
        client: makeClient() as never,
        traceNote: {
          traceId: "missing-trace",
          note: "This will fail",
        },
      })
    ).rejects.toThrow("Failed to add trace note: Trace not found");
  });

  it("throws when no data is returned", async () => {
    mockPOST.mockResolvedValueOnce({
      data: undefined,
      error: undefined,
    });

    await expect(
      addTraceNote({
        client: makeClient() as never,
        traceNote: {
          traceId: "trace123",
          note: "This will fail",
        },
      })
    ).rejects.toThrow("Failed to add trace note: no data returned");
  });

  it("fails fast on older Phoenix servers", async () => {
    const guardedPOST = vi.fn();
    const mockClient = {
      getServerVersion: async () => [14, 12, 0] as [number, number, number],
      POST: guardedPOST,
    };

    await expect(
      addTraceNote({
        client: mockClient as never,
        traceNote: {
          traceId: "trace123",
          note: "This is a trace note",
        },
      })
    ).rejects.toThrow(/requires Phoenix server >= 14\.13\.0/);

    expect(guardedPOST).not.toHaveBeenCalled();
  });
});
