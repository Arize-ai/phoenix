import { describe, expect, it, vi } from "vitest";

const { mockGetSpans } = vi.hoisted(() => ({
  mockGetSpans: vi.fn(),
}));

vi.mock("@arizeai/phoenix-client/spans", () => ({
  getSpans: mockGetSpans,
}));

import {
  buildProjectSpansRequest,
  fetchProjectSpans,
  resolveStartTime,
} from "../src/spanUtils";

describe("buildProjectSpansRequest", () => {
  it("maps MCP span filters to phoenix-client getSpans params", () => {
    expect(
      buildProjectSpansRequest({
        cursor: "cursor-1",
        limit: 25,
        startTime: "2026-03-20T00:00:00.000Z",
        endTime: "2026-03-20T01:00:00.000Z",
        traceIds: ["trace-1"],
        parentId: null,
        names: ["chat_completion"],
        spanKinds: ["LLM"],
        statusCodes: ["OK"],
      })
    ).toEqual({
      cursor: "cursor-1",
      limit: 25,
      startTime: "2026-03-20T00:00:00.000Z",
      endTime: "2026-03-20T01:00:00.000Z",
      traceIds: ["trace-1"],
      parentId: null,
      name: ["chat_completion"],
      spanKind: ["LLM"],
      statusCode: ["OK"],
    });
  });
});

describe("fetchProjectSpans", () => {
  it("delegates span fetching to phoenix-client getSpans", async () => {
    const client = {} as never;

    mockGetSpans.mockResolvedValueOnce({
      spans: [],
      nextCursor: null,
    });

    await expect(
      fetchProjectSpans({
        client,
        projectIdentifier: "default",
        filters: {
          names: ["chat_completion"],
          spanKinds: ["LLM"],
          statusCodes: ["OK"],
        },
      })
    ).resolves.toEqual({
      spans: [],
      nextCursor: null,
    });

    expect(mockGetSpans).toHaveBeenCalledWith({
      client,
      project: { project: "default" },
      limit: 100,
      name: ["chat_completion"],
      spanKind: ["LLM"],
      statusCode: ["OK"],
    });
  });
});

describe("resolveStartTime", () => {
  it("prefers an explicit since timestamp", () => {
    expect(
      resolveStartTime({
        since: "2026-03-20T00:00:00.000Z",
        lastNMinutes: 15,
      })
    ).toBe("2026-03-20T00:00:00.000Z");
  });

  it("derives a timestamp from lastNMinutes", () => {
    expect(
      resolveStartTime({
        lastNMinutes: 30,
        now: new Date("2026-03-20T01:00:00.000Z"),
      })
    ).toBe("2026-03-20T00:30:00.000Z");
  });
});
