import { describe, expect, it } from "vitest";

import { createClientToolTimingRecorder } from "../clientToolTimings";

describe("createClientToolTimingRecorder", () => {
  it("keeps the first start and end and clears completed timings", () => {
    const times = [
      new Date("2026-07-10T12:00:00Z"),
      new Date("2026-07-10T12:00:01Z"),
      new Date("2026-07-10T12:00:02Z"),
      new Date("2026-07-10T12:00:03Z"),
    ];
    const recorder = createClientToolTimingRecorder({
      getCurrentTime: () => times.shift() ?? new Date(0),
    });

    recorder.recordEnd("missing");
    recorder.recordStart("call-1");
    recorder.recordStart("call-1");
    expect(recorder.get("call-1")).toBeNull();
    recorder.recordEnd("call-1");
    recorder.recordEnd("call-1");

    expect(recorder.get("call-1")).toEqual({
      startedAt: "2026-07-10T12:00:00.000Z",
      endedAt: "2026-07-10T12:00:01.000Z",
    });
    recorder.clear();
    expect(recorder.get("call-1")).toBeNull();
  });

  it("reports a call as in flight from start until end or clear", () => {
    const recorder = createClientToolTimingRecorder();

    expect(recorder.isInFlight("call-1")).toBe(false);
    recorder.recordStart("call-1");
    expect(recorder.isInFlight("call-1")).toBe(true);
    recorder.recordEnd("call-1");
    expect(recorder.isInFlight("call-1")).toBe(false);

    recorder.recordStart("call-2");
    recorder.clear();
    expect(recorder.isInFlight("call-2")).toBe(false);
  });
});
