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
  StreamStateProvider,
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

function TimeRangeProbe() {
  const value = useTimeRange();
  useEffect(() => {
    timeRange = value;
  }, [value]);
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

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-06-09T10:00:30.000Z"));
  lastUpdated.value = "2026-06-09T10:00:00.000Z";
  chartRequests.length = 0;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root.render(
      <MemoryRouter initialEntries={["/projects/p/spans?timeRangeKey=7d"]}>
        <PreferencesProvider>
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
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  setPageVisibility("visible");
  vi.useRealTimers();
});

describe("a live project page", () => {
  it("sends one chart request a minute however much new data lands", () => {
    expect(chartRequests).toHaveLength(1);

    for (let tick = 0; tick < 5; tick++) {
      advanceTime(10_000);
      landNewData();
    }

    expect(chartRequests).toHaveLength(1);

    advanceTime(DEFAULT_MAX_AGGREGATES_AGE_MS - 50_000);

    expect(chartRequests).toHaveLength(2);

    // Nothing new: the next minute sends nothing.
    advanceTime(DEFAULT_MAX_AGGREGATES_AGE_MS);

    expect(chartRequests).toHaveLength(2);
  });

  it("refreshes the charts at once when the time range changes", () => {
    advanceTime(10_000);
    landNewData();
    act(() =>
      timeRange.setTimeRange({ timeRangeKey: "1d", start: null, end: null })
    );

    expect(chartRequests).toHaveLength(2);
  });

  it("catches up once when a hidden tab is shown", () => {
    act(() => setPageVisibility("hidden"));
    landNewData();
    advanceTime(DEFAULT_MAX_AGGREGATES_AGE_MS * 3);

    expect(chartRequests).toHaveLength(1);

    act(() => setPageVisibility("visible"));

    expect(chartRequests).toHaveLength(2);
  });
});
