import { describe, expect, it } from "vitest";

import { buildSpanQuery, resolveStartTime } from "../src/spanUtils";

describe("buildSpanQuery", () => {
  it("maps MCP span filters to Phoenix API query fields", () => {
    expect(
      buildSpanQuery({
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
      start_time: "2026-03-20T00:00:00.000Z",
      end_time: "2026-03-20T01:00:00.000Z",
      trace_id: ["trace-1"],
      parent_id: null,
      name: ["chat_completion"],
      span_kind: ["LLM"],
      status_code: ["OK"],
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
