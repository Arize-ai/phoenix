import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AgentProvider } from "@phoenix/contexts/AgentContext";
import { PreferencesProvider } from "@phoenix/contexts/PreferencesContext";

import {
  type TimeRangeContextType,
  TimeRangeProvider,
  useTimeRange,
} from "../TimeRangeContext";
import type { OpenTimeRangeWithKey } from "../types";

function TimeRangeReader({
  onRender,
  onSetTimeRange,
}: {
  onRender: (timeRange: OpenTimeRangeWithKey) => void;
  onSetTimeRange?: (setTimeRange: TimeRangeContextType["setTimeRange"]) => void;
}) {
  const { timeRange, setTimeRange } = useTimeRange();
  onRender(timeRange);
  onSetTimeRange?.(setTimeRange);
  return null;
}

describe("TimeRangeProvider", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-09T10:00:30.000Z"));
    window.localStorage.clear();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    window.localStorage.clear();
    vi.useRealTimers();
  });

  it("keeps last-N ranges open-ended and advances them at refresh boundaries", () => {
    const renderedTimeRanges: OpenTimeRangeWithKey[] = [];

    act(() => {
      root.render(
        <PreferencesProvider lastNTimeRangeKey="15m">
          <AgentProvider>
            <TimeRangeProvider>
              <TimeRangeReader
                onRender={(timeRange) => {
                  renderedTimeRanges.push(timeRange);
                }}
              />
            </TimeRangeProvider>
          </AgentProvider>
        </PreferencesProvider>
      );
    });

    expect(renderedTimeRanges.at(-1)?.timeRangeKey).toBe("15m");
    expect(renderedTimeRanges.at(-1)?.start?.toISOString()).toBe(
      "2026-06-09T09:45:00.000Z"
    );
    expect(renderedTimeRanges.at(-1)?.end).toBeNull();

    act(() => {
      vi.advanceTimersByTime(30_000);
    });

    expect(renderedTimeRanges.at(-1)?.timeRangeKey).toBe("15m");
    expect(renderedTimeRanges.at(-1)?.start?.toISOString()).toBe(
      "2026-06-09T09:46:00.000Z"
    );
    expect(renderedTimeRanges.at(-1)?.end).toBeNull();
  });

  it("preserves custom open bounds", () => {
    const renderedTimeRanges: OpenTimeRangeWithKey[] = [];
    let setTimeRange: TimeRangeContextType["setTimeRange"] | null = null;
    const start = new Date("2026-06-09T09:00:00.000Z");
    const end = new Date("2026-06-09T11:00:00.000Z");

    act(() => {
      root.render(
        <PreferencesProvider lastNTimeRangeKey="15m">
          <AgentProvider>
            <TimeRangeProvider>
              <TimeRangeReader
                onRender={(timeRange) => {
                  renderedTimeRanges.push(timeRange);
                }}
                onSetTimeRange={(nextSetTimeRange) => {
                  setTimeRange = nextSetTimeRange;
                }}
              />
            </TimeRangeProvider>
          </AgentProvider>
        </PreferencesProvider>
      );
    });

    act(() => {
      setTimeRange?.({ timeRangeKey: "custom", start, end: null });
    });

    expect(renderedTimeRanges.at(-1)?.timeRangeKey).toBe("custom");
    expect(renderedTimeRanges.at(-1)?.start).toBe(start);
    expect(renderedTimeRanges.at(-1)?.end).toBeNull();

    act(() => {
      setTimeRange?.({ timeRangeKey: "custom", start: null, end });
    });

    expect(renderedTimeRanges.at(-1)?.timeRangeKey).toBe("custom");
    expect(renderedTimeRanges.at(-1)?.start).toBeNull();
    expect(renderedTimeRanges.at(-1)?.end).toBe(end);
  });
});
