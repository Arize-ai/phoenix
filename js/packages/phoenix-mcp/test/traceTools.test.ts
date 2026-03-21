import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetTraces } = vi.hoisted(() => ({
  mockGetTraces: vi.fn(),
}));

vi.mock("@arizeai/phoenix-client/traces", () => ({
  getTraces: mockGetTraces,
}));

import { resolveTraceIdByPrefix } from "../src/traceTools";

describe("resolveTraceIdByPrefix", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the unique matching trace ID after scanning all pages", async () => {
    mockGetTraces
      .mockResolvedValueOnce({
        traces: [
          {
            trace_id: "abc123",
          },
        ],
        nextCursor: "cursor-1",
      })
      .mockResolvedValueOnce({
        traces: [
          {
            trace_id: "zzz999",
          },
        ],
        nextCursor: null,
      });

    await expect(
      resolveTraceIdByPrefix({
        client: {} as never,
        projectId: "project-1",
        projectIdentifier: "default",
        traceIdPrefix: "abc",
      })
    ).resolves.toBe("abc123");
  });

  it("throws when a trace ID prefix matches more than one trace", async () => {
    mockGetTraces.mockResolvedValueOnce({
      traces: [
        {
          trace_id: "abc123",
        },
        {
          trace_id: "abc456",
        },
      ],
      nextCursor: null,
    });

    await expect(
      resolveTraceIdByPrefix({
        client: {} as never,
        projectId: "project-1",
        projectIdentifier: "default",
        traceIdPrefix: "abc",
      })
    ).rejects.toThrow(
      'Trace ID prefix "abc" is ambiguous in project "default": abc123, abc456'
    );
  });

  it("returns null when no trace IDs match the prefix", async () => {
    mockGetTraces.mockResolvedValueOnce({
      traces: [
        {
          trace_id: "xyz789",
        },
      ],
      nextCursor: null,
    });

    await expect(
      resolveTraceIdByPrefix({
        client: {} as never,
        projectId: "project-1",
        projectIdentifier: "default",
        traceIdPrefix: "abc",
      })
    ).resolves.toBeNull();
  });
});
