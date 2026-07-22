/**
 * Trace-verification window tests: the clock-skew allowance widens the span
 * query only when the project had no spans before instrumentation began.
 */

import { describe, expect, it } from "vitest";

import {
  hasSpansInSkewWindow,
  waitForFirstTrace,
} from "../../src/setup/steps/verifyTraces";
import { buildFakeDeps, fakeFetch, jsonResponse } from "./fakes";

const CONNECTION = {
  endpoint: "http://localhost:6006",
  projectName: "my-app",
};

/** start_time values (epoch ms) of the span-search requests issued. */
function recordingSpanFetch(data: unknown[]) {
  const windowStarts: number[] = [];
  const fetch = fakeFetch((url) => {
    if (!url.includes("/spans?")) {
      return undefined;
    }
    const startTime = new URL(url).searchParams.get("start_time");
    windowStarts.push(Date.parse(startTime ?? ""));
    return jsonResponse(200, { data });
  });
  return { windowStarts, fetch };
}

describe("hasSpansInSkewWindow", () => {
  it("reaches back by the skew tolerance from the start time", async () => {
    const { windowStarts, fetch } = recordingSpanFetch([]);
    const deps = buildFakeDeps({ fetch });
    expect(
      await hasSpansInSkewWindow(deps, CONNECTION, { sinceMs: 120_000 })
    ).toBe(false);
    expect(windowStarts).toEqual([60_000]);
  });
});

describe("waitForFirstTrace", () => {
  it("widens the window by the skew tolerance by default", async () => {
    const { windowStarts, fetch } = recordingSpanFetch([{ id: "span1" }]);
    const deps = buildFakeDeps({ fetch });
    expect(
      await waitForFirstTrace(deps, CONNECTION, { sinceMs: 120_000 })
    ).toBe(true);
    expect(windowStarts).toEqual([60_000]);
  });

  it("queries the exact start when the skew allowance is disabled", async () => {
    const { windowStarts, fetch } = recordingSpanFetch([{ id: "span1" }]);
    const deps = buildFakeDeps({ fetch });
    expect(
      await waitForFirstTrace(deps, CONNECTION, {
        sinceMs: 120_000,
        allowClockSkew: false,
      })
    ).toBe(true);
    expect(windowStarts).toEqual([120_000]);
  });
});
