import { Suspense, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  type TimeRangeContextType,
  TimeRangeContext,
} from "@phoenix/components/datetime";

import { useClosedTimeRange } from "../useClosedTimeRange";

describe("useClosedTimeRange", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-09T10:00:30.000Z"));
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.useRealTimers();
  });

  it("keeps the provider-owned end stable when a suspended render retries", async () => {
    const timeRangeNow = new Date("2026-06-09T10:00:30.000Z").getTime();
    const renderedEndTimes: number[] = [];
    let shouldSuspend = true;
    let resolveSuspension: (() => void) | undefined;
    const suspension = new Promise<void>((resolve) => {
      resolveSuspension = resolve;
    });
    const contextValue: TimeRangeContextType = {
      timeRange: {
        timeRangeKey: "12h",
        start: new Date("2026-06-08T22:00:00.000Z"),
        end: null,
      },
      timeRangeNow,
      timeRangeISOStrings: {
        start: "2026-06-08T22:00:00.000Z",
        end: undefined,
      },
      setTimeRange: vi.fn(),
      setCustomTimeRange: vi.fn(),
      refreshLiveTimeRange: vi.fn(),
    };

    function SuspendedRangeReader() {
      const timeRange = useClosedTimeRange();
      renderedEndTimes.push(timeRange.end.getTime());
      if (shouldSuspend) {
        throw suspension;
      }
      return null;
    }

    await act(async () => {
      root.render(
        <TimeRangeContext.Provider value={contextValue}>
          <Suspense fallback={null}>
            <SuspendedRangeReader />
          </Suspense>
        </TimeRangeContext.Provider>
      );
    });

    expect(renderedEndTimes.length).toBeGreaterThan(0);
    expect(new Set(renderedEndTimes)).toEqual(new Set([timeRangeNow]));

    await act(async () => {
      vi.setSystemTime(new Date("2026-06-09T10:01:30.000Z"));
      shouldSuspend = false;
      resolveSuspension?.();
      await suspension;
    });

    expect(renderedEndTimes.length).toBeGreaterThan(1);
    expect(new Set(renderedEndTimes)).toEqual(new Set([timeRangeNow]));
  });
});
