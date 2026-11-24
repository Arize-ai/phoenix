import { act, type ReactNode, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import type * as ReactRelayModule from "react-relay";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type * as DateTimeModule from "@phoenix/components/datetime";
import {
  TimeRangeProvider,
  type TimeRangeContextType,
  useTimeRange,
} from "@phoenix/components/datetime";
import { AgentProvider } from "@phoenix/contexts/AgentContext";
import { PreferencesProvider } from "@phoenix/contexts/PreferencesContext";
import {
  DEFAULT_MAX_AGGREGATES_AGE_MS,
  type StreamStateContextType,
  StreamStateProvider,
  useStreamState,
} from "@phoenix/contexts/StreamStateContext";

import type { ProjectTimeRangeControls_data$key } from "../__generated__/ProjectTimeRangeControls_data.graphql";

/** The project's last-updated time, which the controls poll. */
const lastUpdated = vi.hoisted(() => {
  const listeners = new Set<() => void>();
  return {
    value: null as string | null,
    listeners,
    set(value: string) {
      this.value = value;
      listeners.forEach((listener) => listener());
    },
  };
});

/** One entry per request a strip chart sends: its range and fetch key. */
const chartRequests = vi.hoisted(() => [] as string[]);

vi.mock("react-relay", async (importOriginal) => {
  const React = await import("react");
  return {
    ...(await importOriginal<typeof ReactRelayModule>()),
    useRefetchableFragment: () => [
      {
        streamingLastUpdatedAt: React.useSyncExternalStore(
          (listener: () => void) => {
            lastUpdated.listeners.add(listener);
            return () => lastUpdated.listeners.delete(listener);
          },
          () => lastUpdated.value
        ),
      },
      () => {},
    ],
  };
});

vi.mock("@phoenix/components/datetime", async (importOriginal) => ({
  ...(await importOriginal<typeof DateTimeModule>()),
  ConnectedTimeRangeControls: () => null,
}));

vi.mock("@phoenix/contexts/ProjectContext", () => ({
  useProjectContext: (
    selector: (state: {
      projectId: string;
      showMetricCharts: boolean;
      metricChartKeys: Record<string, string[]>;
    }) => unknown
  ) =>
    selector({
      projectId: "UHJvamVjdDox",
      showMetricCharts: true,
      metricChartKeys: { spans: ["traffic"] },
    }),
}));

vi.mock("@phoenix/components/chart", () => ({
  ChartPanelStrip: ({ children }: { children: ReactNode }) => children,
  ChartPanelStripSkeleton: () => null,
  METRIC_CHARTS_CONTENT_PANEL_ID: "content",
  MetricChartsPanel: ({ children }: { children: ReactNode }) => children,
  useMetricChartsLayout: () => ({}),
}));

vi.mock("react-resizable-panels", () => ({
  Group: ({ children }: { children: ReactNode }) => children,
  Panel: ({ children }: { children: ReactNode }) => children,
}));

vi.mock("../metrics/chartCatalog", async () => {
  const { useMetricQueryFetchKey } = await import("../metrics/types");
  return {
    getProjectMetricCharts: (keys: string[]) => keys.map((key) => ({ key })),
    // A chart's query is identified by its range and fetch key, so each new
    // pair is one request.
    DeferredProjectMetricPanel: ({
      timeRange,
    }: {
      timeRange: { start: Date; end: Date };
    }) => {
      const fetchKey = useMetricQueryFetchKey();
      const request = `${timeRange.start.toISOString()}..${timeRange.end.toISOString()} ${fetchKey}`;
      useEffect(() => {
        chartRequests.push(request);
      }, [request]);
      return null;
    },
  };
});

import { ProjectTimeRangeControls } from "../ProjectTimeRangeControls";
import { TableMetricsChartsPanelGroup } from "../TableMetricsCharts";

let container: HTMLDivElement;
let root: Root;
let timeRange: TimeRangeContextType;
let streamState: StreamStateContextType;

function TimeRangeProbe() {
  const value = useTimeRange();
  const stream = useStreamState();
  useEffect(() => {
    timeRange = value;
    streamState = stream;
  }, [value, stream]);
  return null;
}

function setPageVisibility(visibilityState: DocumentVisibilityState) {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => visibilityState,
  });
  document.dispatchEvent(new Event("visibilitychange"));
}

function advanceTime(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

/** New data lands: the controls' next poll sees a newer last-updated time. */
function landNewData() {
  act(() => lastUpdated.set(new Date().toISOString()));
}

/** Renders the spans tab on the last 7 days, streaming unless told not to. */
function renderLivePage({
  traceStreamingEnabled = true,
}: { traceStreamingEnabled?: boolean } = {}) {
  act(() => {
    root.render(
      <MemoryRouter initialEntries={["/projects/p/spans?timeRangeKey=7d"]}>
        <PreferencesProvider traceStreamingEnabled={traceStreamingEnabled}>
          <AgentProvider>
            <TimeRangeProvider>
              <StreamStateProvider>
                <Routes>
                  <Route
                    path="/projects/:projectId/spans"
                    element={
                      <>
                        <TimeRangeProbe />
                        <ProjectTimeRangeControls
                          project={{} as ProjectTimeRangeControls_data$key}
                        />
                        <TableMetricsChartsPanelGroup view="spans">
                          {null}
                        </TableMetricsChartsPanelGroup>
                      </>
                    }
                  />
                </Routes>
              </StreamStateProvider>
            </TimeRangeProvider>
          </AgentProvider>
        </PreferencesProvider>
      </MemoryRouter>
    );
  });
}

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  // The preferences store persists the live toggle across renders.
  localStorage.clear();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-06-09T10:00:30.000Z"));
  lastUpdated.value = "2026-06-09T10:00:00.000Z";
  chartRequests.length = 0;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  setPageVisibility("visible");
  vi.useRealTimers();
});

describe("a live project page", () => {
  it("sends one chart request a minute however much new data lands", () => {
    renderLivePage();
    expect(chartRequests).toHaveLength(1);

    for (let tick = 0; tick < 5; tick++) {
      advanceTime(10_000);
      landNewData();
    }

    expect(chartRequests).toHaveLength(1);

    advanceTime(DEFAULT_MAX_AGGREGATES_AGE_MS - 50_000);

    expect(chartRequests).toEqual([
      "2026-06-02T10:00:00.000Z..2026-06-09T10:00:30.000Z initial",
      "2026-06-02T10:00:00.000Z..2026-06-09T10:01:30.000Z fetch-traces-2026-06-09T10:01:20.000Z",
    ]);

    // Nothing new: the next minute sends nothing.
    advanceTime(DEFAULT_MAX_AGGREGATES_AGE_MS);

    expect(chartRequests).toHaveLength(2);
  });

  it("refreshes the charts at once when the time range changes", () => {
    renderLivePage();
    advanceTime(10_000);
    landNewData();
    act(() =>
      timeRange.setTimeRange({ timeRangeKey: "1d", start: null, end: null })
    );

    expect(chartRequests).toHaveLength(2);
  });

  it.each([
    {
      preset: "1h",
      result: "no range a month ahead",
      request: "2026-06-09T11:00:00.000Z..2026-06-09T12:00:30.000Z initial",
    },
    {
      preset: "30d",
      result: "no missing recent data",
      request: "2026-05-10T12:00:00.000Z..2026-06-09T12:00:30.000Z initial",
    },
  ] as const)(
    "ends the charts' range when $preset is picked hours into a pause: $result",
    ({ preset, request }) => {
      renderLivePage({ traceStreamingEnabled: false });
      advanceTime(2 * 60 * 60_000);
      act(() =>
        timeRange.setTimeRange({ timeRangeKey: preset, start: null, end: null })
      );

      expect(chartRequests.at(-1)).toBe(request);
    }
  );

  it("refreshes the charts at once when live is turned off while they are behind", () => {
    renderLivePage();
    advanceTime(10_000);
    landNewData();
    act(() => streamState.setIsStreaming(false));

    expect(chartRequests).toEqual([
      "2026-06-02T10:00:00.000Z..2026-06-09T10:00:30.000Z initial",
      "2026-06-02T10:00:00.000Z..2026-06-09T10:00:40.000Z fetch-traces-2026-06-09T10:00:40.000Z",
    ]);
  });

  it("ends the charts' range at now, in one request, when a user action refreshes them", () => {
    renderLivePage({ traceStreamingEnabled: false });
    advanceTime(50_000);
    act(() => streamState.setFetchKey({ fetchKey: "trace-transfer-1" }));

    expect(chartRequests).toEqual([
      "2026-06-02T10:00:00.000Z..2026-06-09T10:00:30.000Z initial",
      "2026-06-02T10:00:00.000Z..2026-06-09T10:01:20.000Z trace-transfer-1",
    ]);
  });

  it("catches up on the next minute after a hidden tab is shown", () => {
    renderLivePage();
    act(() => setPageVisibility("hidden"));
    landNewData();
    advanceTime(DEFAULT_MAX_AGGREGATES_AGE_MS * 3);

    expect(chartRequests).toHaveLength(1);

    act(() => setPageVisibility("visible"));
    advanceTime(DEFAULT_MAX_AGGREGATES_AGE_MS);

    expect(chartRequests).toHaveLength(2);
  });
});
