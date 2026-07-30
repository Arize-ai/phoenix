/**
 * Trace-verification window tests: the clock-skew allowance widens the span
 * query only when the project was confirmed to have no spans before
 * instrumentation began.
 */

import { describe, expect, it } from "vitest";

import {
  skewWindowIsClear,
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

describe("skewWindowIsClear", () => {
  it("reaches back by the skew tolerance from the start time", async () => {
    const { windowStarts, fetch } = recordingSpanFetch([]);
    const deps = buildFakeDeps({ fetch });
    expect(
      await skewWindowIsClear(deps, CONNECTION, { sinceMs: 120_000 })
    ).toBe(true);
    expect(windowStarts).toEqual([60_000]);
  });

  it("is not clear when the window already holds a span", async () => {
    const { fetch } = recordingSpanFetch([{ id: "span1" }]);
    const deps = buildFakeDeps({ fetch });
    expect(
      await skewWindowIsClear(deps, CONNECTION, { sinceMs: 120_000 })
    ).toBe(false);
  });

  it("treats a project that does not exist as an empty window", async () => {
    // 404 is a definite "no spans": the project has none to have created it.
    const deps = buildFakeDeps({
      fetch: fakeFetch((url) =>
        url.includes("/spans?")
          ? jsonResponse(404, { detail: "not found" })
          : undefined
      ),
    });
    expect(
      await skewWindowIsClear(deps, CONNECTION, { sinceMs: 120_000 })
    ).toBe(true);
  });

  it("fails closed when the probe cannot answer", async () => {
    // A transport failure is not proof the window was empty, and granting the
    // skew allowance on it would let a span from before this run verify it.
    const deps = buildFakeDeps({
      fetch: (async () => {
        throw new TypeError("connection reset");
      }) as typeof fetch,
    });
    expect(
      await skewWindowIsClear(deps, CONNECTION, { sinceMs: 120_000 })
    ).toBe(false);
  });

  it("fails closed when the probe is rejected", async () => {
    const deps = buildFakeDeps({
      fetch: fakeFetch((url) =>
        url.includes("/spans?")
          ? jsonResponse(401, { detail: "unauthorized" })
          : undefined
      ),
    });
    expect(
      await skewWindowIsClear(deps, CONNECTION, { sinceMs: 120_000 })
    ).toBe(false);
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

  it("does not verify when the API never answers", async () => {
    let clock = 0;
    const deps = buildFakeDeps({
      fetch: (async () => {
        throw new TypeError("connection reset");
      }) as typeof fetch,
      clock: { now: () => (clock += 61_000) },
    });
    expect(
      await waitForFirstTrace(deps, CONNECTION, { sinceMs: 0, headless: true })
    ).toBe(false);
  });

  it("does not verify when the project does not exist", async () => {
    let clock = 0;
    const deps = buildFakeDeps({
      fetch: fakeFetch((url) =>
        url.includes("/spans?")
          ? jsonResponse(404, { detail: "not found" })
          : undefined
      ),
      clock: { now: () => (clock += 61_000) },
    });
    expect(
      await waitForFirstTrace(deps, CONNECTION, { sinceMs: 0, headless: true })
    ).toBe(false);
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
