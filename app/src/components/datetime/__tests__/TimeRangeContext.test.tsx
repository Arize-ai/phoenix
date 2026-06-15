import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  MemoryRouter,
  type NavigateFunction,
  useLocation,
  useNavigate,
} from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SELECTED_SPAN_NODE_ID_PARAM } from "@phoenix/constants/searchParams";
import { AgentProvider } from "@phoenix/contexts/AgentContext";
import { PreferencesProvider } from "@phoenix/contexts/PreferencesContext";

import {
  type TimeRangeContextType,
  TimeRangeProvider,
  useTimeRange,
} from "../TimeRangeContext";
import type { LastNTimeRangeKey, OpenTimeRangeWithKey } from "../types";

function TimeRangeReader({
  onRender,
  onSetTimeRange,
  onLocation,
  onNavigate,
}: {
  onRender: (timeRange: OpenTimeRangeWithKey) => void;
  onSetTimeRange?: (setTimeRange: TimeRangeContextType["setTimeRange"]) => void;
  onLocation?: (search: string) => void;
  onNavigate?: (navigate: NavigateFunction) => void;
}) {
  const { timeRange, setTimeRange } = useTimeRange();
  const location = useLocation();
  const navigate = useNavigate();
  onRender(timeRange);
  onSetTimeRange?.(setTimeRange);
  onLocation?.(location.search);
  onNavigate?.(navigate);
  return null;
}

function renderTimeRangeProvider({
  root,
  initialEntry = "/projects/project-1/traces",
  lastNTimeRangeKey = "15m",
  onRender,
  onSetTimeRange,
  onLocation,
  onNavigate,
}: {
  root: Root;
  initialEntry?: string;
  lastNTimeRangeKey?: LastNTimeRangeKey;
  onRender: (timeRange: OpenTimeRangeWithKey) => void;
  onSetTimeRange?: (setTimeRange: TimeRangeContextType["setTimeRange"]) => void;
  onLocation?: (search: string) => void;
  onNavigate?: (navigate: NavigateFunction) => void;
}) {
  act(() => {
    root.render(
      <MemoryRouter initialEntries={[initialEntry]}>
        <PreferencesProvider lastNTimeRangeKey={lastNTimeRangeKey}>
          <AgentProvider>
            <TimeRangeProvider>
              <TimeRangeReader
                onRender={onRender}
                onSetTimeRange={onSetTimeRange}
                onLocation={onLocation}
                onNavigate={onNavigate}
              />
            </TimeRangeProvider>
          </AgentProvider>
        </PreferencesProvider>
      </MemoryRouter>
    );
  });
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

    renderTimeRangeProvider({
      root,
      onRender: (timeRange) => {
        renderedTimeRanges.push(timeRange);
      },
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

    renderTimeRangeProvider({
      root,
      onRender: (timeRange) => {
        renderedTimeRanges.push(timeRange);
      },
      onSetTimeRange: (nextSetTimeRange) => {
        setTimeRange = nextSetTimeRange;
      },
    });

    act(() => {
      setTimeRange?.({ timeRangeKey: "custom", start, end: null });
    });

    expect(renderedTimeRanges.at(-1)?.timeRangeKey).toBe("custom");
    expect(renderedTimeRanges.at(-1)?.start).toStrictEqual(start);
    expect(renderedTimeRanges.at(-1)?.end).toBeNull();

    act(() => {
      setTimeRange?.({ timeRangeKey: "custom", start: null, end });
    });

    expect(renderedTimeRanges.at(-1)?.timeRangeKey).toBe("custom");
    expect(renderedTimeRanges.at(-1)?.start).toBeNull();
    expect(renderedTimeRanges.at(-1)?.end).toStrictEqual(end);
  });

  it("initializes from URL search params before stored preferences", () => {
    const renderedTimeRanges: OpenTimeRangeWithKey[] = [];

    renderTimeRangeProvider({
      root,
      initialEntry: "/projects/project-1/traces?timeRangeKey=1h",
      lastNTimeRangeKey: "15m",
      onRender: (timeRange) => {
        renderedTimeRanges.push(timeRange);
      },
    });

    expect(renderedTimeRanges.at(-1)?.timeRangeKey).toBe("1h");
    expect(renderedTimeRanges.at(-1)?.start?.toISOString()).toBe(
      "2026-06-09T09:00:00.000Z"
    );
    expect(renderedTimeRanges.at(-1)?.end).toBeNull();
  });

  it("initializes from concrete last-N URL bounds before stored preferences", () => {
    const renderedTimeRanges: OpenTimeRangeWithKey[] = [];

    renderTimeRangeProvider({
      root,
      initialEntry:
        "/projects/project-1/traces?timeRangeKey=1h&timeRangeStart=2026-06-09T08%3A00%3A00.000Z&timeRangeEnd=2026-06-09T09%3A00%3A00.000Z",
      lastNTimeRangeKey: "15m",
      onRender: (timeRange) => {
        renderedTimeRanges.push(timeRange);
      },
    });

    expect(renderedTimeRanges.at(-1)?.timeRangeKey).toBe("1h");
    expect(renderedTimeRanges.at(-1)?.start?.toISOString()).toBe(
      "2026-06-09T08:00:00.000Z"
    );
    expect(renderedTimeRanges.at(-1)?.end?.toISOString()).toBe(
      "2026-06-09T09:00:00.000Z"
    );

    act(() => {
      vi.advanceTimersByTime(60_000);
    });

    expect(renderedTimeRanges.at(-1)?.start?.toISOString()).toBe(
      "2026-06-09T08:00:00.000Z"
    );
    expect(renderedTimeRanges.at(-1)?.end?.toISOString()).toBe(
      "2026-06-09T09:00:00.000Z"
    );
  });

  it("canonicalizes relative last-N URLs with concrete bounds", () => {
    const renderedLocations: string[] = [];

    renderTimeRangeProvider({
      root,
      initialEntry: "/projects/project-1/traces?timeRangeKey=7d",
      lastNTimeRangeKey: "15m",
      onRender: () => null,
      onLocation: (search) => {
        renderedLocations.push(search);
      },
    });

    const latestSearchParams = new URLSearchParams(
      renderedLocations.at(-1) ?? ""
    );
    expect(latestSearchParams.get("timeRangeKey")).toBe("7d");
    expect(latestSearchParams.get("timeRangeStart")).toBe(
      "2026-06-02T10:00:00.000Z"
    );
    expect(latestSearchParams.get("timeRangeEnd")).toBe(
      "2026-06-09T10:00:30.000Z"
    );
  });

  it("keeps locally selected last-N ranges live when unrelated params change", () => {
    const renderedTimeRanges: OpenTimeRangeWithKey[] = [];
    const renderedLocations: string[] = [];
    let navigate: NavigateFunction | null = null;

    renderTimeRangeProvider({
      root,
      onRender: (timeRange) => {
        renderedTimeRanges.push(timeRange);
      },
      onLocation: (search) => {
        renderedLocations.push(search);
      },
      onNavigate: (nextNavigate) => {
        navigate = nextNavigate;
      },
    });

    act(() => {
      const nextSearchParams = new URLSearchParams(
        renderedLocations.at(-1) ?? ""
      );
      nextSearchParams.set(SELECTED_SPAN_NODE_ID_PARAM, "span-1");
      navigate?.({ search: `?${nextSearchParams.toString()}` });
    });

    act(() => {
      vi.advanceTimersByTime(30_000);
    });

    const latestSearchParams = new URLSearchParams(
      renderedLocations.at(-1) ?? ""
    );
    expect(renderedTimeRanges.at(-1)?.timeRangeKey).toBe("15m");
    expect(renderedTimeRanges.at(-1)?.start?.toISOString()).toBe(
      "2026-06-09T09:46:00.000Z"
    );
    expect(renderedTimeRanges.at(-1)?.end).toBeNull();
    expect(latestSearchParams.get(SELECTED_SPAN_NODE_ID_PARAM)).toBe("span-1");
    expect(latestSearchParams.get("timeRangeStart")).toBe(
      "2026-06-09T09:46:00.000Z"
    );
    expect(latestSearchParams.get("timeRangeEnd")).toBe(
      "2026-06-09T10:01:00.000Z"
    );
  });

  it("writes selected time ranges to the URL while preserving unrelated params", () => {
    const renderedLocations: string[] = [];
    let setTimeRange: TimeRangeContextType["setTimeRange"] | null = null;
    const start = new Date("2026-06-09T09:00:00.000Z");
    const end = new Date("2026-06-09T11:00:00.000Z");

    renderTimeRangeProvider({
      root,
      initialEntry:
        "/projects/project-1/traces?selectedSpanNodeId=span-1&timeRangeKey=15m",
      onRender: () => null,
      onLocation: (search) => {
        renderedLocations.push(search);
      },
      onSetTimeRange: (nextSetTimeRange) => {
        setTimeRange = nextSetTimeRange;
      },
    });

    act(() => {
      setTimeRange?.({ timeRangeKey: "custom", start, end });
    });

    const latestSearchParams = new URLSearchParams(
      renderedLocations.at(-1) ?? ""
    );
    expect(latestSearchParams.get("selectedSpanNodeId")).toBe("span-1");
    expect(latestSearchParams.get("timeRangeKey")).toBeNull();
    expect(latestSearchParams.get("timeRangeStart")).toBe(
      "2026-06-09T09:00:00.000Z"
    );
    expect(latestSearchParams.get("timeRangeEnd")).toBe(
      "2026-06-09T11:00:00.000Z"
    );
  });
});
