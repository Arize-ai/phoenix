import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import type * as ReactRelayModule from "react-relay";
import type * as ReactRouterModule from "react-router";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PreferencesProvider } from "@phoenix/contexts/PreferencesContext";
import { StreamStateProvider } from "@phoenix/contexts/StreamStateContext";
import type * as HooksModule from "@phoenix/hooks";

/** The fetch keys the queue strip and the charts were rendered with. */
const fetchKeys = vi.hoisted(() => ({
  strip: [] as string[],
  charts: [] as string[],
}));

vi.mock("react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof ReactRouterModule>()),
  useLoaderData: () => ({
    queryRef: { source: {} },
    timeRange: {},
    filter: "",
    scoreWindow: null,
    includeMeanScore: false,
  }),
}));

vi.mock("react-relay", async (importOriginal) => ({
  ...(await importOriginal<typeof ReactRelayModule>()),
  useRelayEnvironment: () => ({}),
}));

vi.mock("@phoenix/hooks", async (importOriginal) => ({
  ...(await importOriginal<typeof HooksModule>()),
  useOwnedPreloadedQuery: () => ({ project: { evaluatorCount: 1 } }),
}));

vi.mock("@phoenix/components/datetime", () => ({
  useTimeRange: () => ({ timeRangeISOStrings: {} }),
}));

vi.mock(
  "@phoenix/pages/project/evaluators/ProjectEvaluatorQueueStats",
  async () => {
    const { createContext } = await import("react");
    return {
      QueueStatsRefreshContext: createContext(null),
      ProjectEvaluationQueueStrip: ({ fetchKey }: { fetchKey: string }) => {
        if (fetchKeys.strip.at(-1) !== fetchKey) {
          fetchKeys.strip.push(fetchKey);
        }
        return null;
      },
    };
  }
);

vi.mock("@phoenix/pages/project/TableMetricsCharts", () => ({
  TableMetricsChartsPanelGroup: ({
    fetchKey,
    children,
  }: {
    fetchKey?: string;
    children: ReactNode;
  }) => {
    if (fetchKey != null && fetchKeys.charts.at(-1) !== fetchKey) {
      fetchKeys.charts.push(fetchKey);
    }
    return children;
  },
}));

vi.mock("@phoenix/pages/project/evaluators/ProjectEvaluatorsTable", () => ({
  ProjectEvaluatorsTable: () => null,
}));

vi.mock("@phoenix/pages/project/evaluators/ProjectEvaluatorsToolbar", () => ({
  ProjectEvaluatorsToolbar: () => null,
}));

vi.mock("@phoenix/pages/project/evaluators/ClearQueuedEvaluationsMenu", () => ({
  ClearQueuedEvaluationsMenu: () => null,
}));

import { ProjectEvaluatorsPage } from "../ProjectEvaluatorsPage";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.useFakeTimers();
  fetchKeys.strip.length = 0;
  fetchKeys.charts.length = 0;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

describe("ProjectEvaluatorsPage", () => {
  it("refreshes the charts with the queue poll, once a minute, while streaming is paused", () => {
    act(() => {
      root.render(
        <MemoryRouter initialEntries={["/projects/p/evaluators"]}>
          <PreferencesProvider traceStreamingEnabled={false}>
            <StreamStateProvider>
              <Routes>
                <Route
                  path="/projects/:projectId/evaluators"
                  element={<ProjectEvaluatorsPage />}
                />
              </Routes>
            </StreamStateProvider>
          </PreferencesProvider>
        </MemoryRouter>
      );
    });
    act(() => {
      vi.advanceTimersByTime(30_000);
    });

    expect(fetchKeys.strip).toHaveLength(2);
    expect(fetchKeys.charts).toHaveLength(1);

    act(() => {
      vi.advanceTimersByTime(30_000);
    });

    expect(fetchKeys.strip).toHaveLength(3);
    expect(fetchKeys.charts).toHaveLength(2);
  });
});
