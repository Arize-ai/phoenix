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
  type TimeRangeISOStrings,
  TimeRangeProvider,
  useTimeRange,
} from "../TimeRangeContext";
import type { LastNTimeRangeKey, OpenTimeRangeWithKey } from "../types";

function TimeRangeReader({
  onRender,
  onRenderISOStrings,
  onSetTimeRange,
  onLocation,
  onNavigate,
}: {
  onRender: (timeRange: OpenTimeRangeWithKey) => void;
  onRenderISOStrings?: (timeRangeISOStrings: TimeRangeISOStrings) => void;
  onSetTimeRange?: (setTimeRange: TimeRangeContextType["setTimeRange"]) => void;
  onLocation?: (search: string) => void;
  onNavigate?: (navigate: NavigateFunction) => void;
}) {
  const { timeRange, timeRangeISOStrings, setTimeRange } = useTimeRange();
  const location = useLocation();
  const navigate = useNavigate();
  onRender(timeRange);
  onRenderISOStrings?.(timeRangeISOStrings);
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
  onRenderISOStrings,
  onSetTimeRange,
  onLocation,
  onNavigate,
}: {
  root: Root;
  initialEntry?: string;
  lastNTimeRangeKey?: LastNTimeRangeKey;
  onRender: (timeRange: OpenTimeRangeWithKey) => void;
  onRenderISOStrings?: (timeRangeISOStrings: TimeRangeISOStrings) => void;
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
                onRenderISOStrings={onRenderISOStrings}
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

  it("exposes a referentially stable ISO string representation", () => {
    const renderedISOStrings: TimeRangeISOStrings[] = [];
    const render = () =>
      renderTimeRangeProvider({
        root,
        initialEntry: "/projects/project-1/traces?timeRangeKey=15m",
        onRender: () => null,
        onRenderISOStrings: (timeRangeISOStrings) => {
          renderedISOStrings.push(timeRangeISOStrings);
        },
      });

    render();
    const initialISOStrings = renderedISOStrings.at(-1);
    expect(initialISOStrings).toEqual({
      start: "2026-06-09T09:45:00.000Z",
      end: undefined,
    });

    render();
    expect(renderedISOStrings.at(-1)).toBe(initialISOStrings);

    act(() => {
      vi.advanceTimersByTime(30_000);
    });
    expect(renderedISOStrings.at(-1)).toEqual({
      start: "2026-06-09T09:46:00.000Z",
      end: undefined,
    });
    expect(renderedISOStrings.at(-1)).not.toBe(initialISOStrings);
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

  it("treats a last-N URL key as live, ignoring any bounds it carries", () => {
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

    // The preset key wins: the window resolves live against "now", not the
    // (stale) bounds carried in the URL. This keeps legacy URLs working.
    expect(renderedTimeRanges.at(-1)?.timeRangeKey).toBe("1h");
    expect(renderedTimeRanges.at(-1)?.start?.toISOString()).toBe(
      "2026-06-09T09:00:00.000Z"
    );
    expect(renderedTimeRanges.at(-1)?.end).toBeNull();

    act(() => {
      vi.advanceTimersByTime(60_000);
    });

    // And it keeps ticking forward like any live preset.
    expect(renderedTimeRanges.at(-1)?.start?.toISOString()).toBe(
      "2026-06-09T09:01:00.000Z"
    );
    expect(renderedTimeRanges.at(-1)?.end).toBeNull();
  });

  it("keeps a relative last-N URL declarative, without adding bounds", () => {
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

    // A live preset is represented by its key alone; no bounds are written.
    const latestSearchParams = new URLSearchParams(
      renderedLocations.at(-1) ?? ""
    );
    expect(latestSearchParams.get("timeRangeKey")).toBe("7d");
    expect(latestSearchParams.get("timeRangeStart")).toBeNull();
    expect(latestSearchParams.get("timeRangeEnd")).toBeNull();
  });

  it("keeps locally selected last-N ranges live and key-only when unrelated params change", () => {
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
    // The live preset stays declarative: only the key is in the URL, never
    // bounds, even as the window advances on refresh.
    expect(latestSearchParams.get("timeRangeKey")).toBe("15m");
    expect(latestSearchParams.get("timeRangeStart")).toBeNull();
    expect(latestSearchParams.get("timeRangeEnd")).toBeNull();
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
