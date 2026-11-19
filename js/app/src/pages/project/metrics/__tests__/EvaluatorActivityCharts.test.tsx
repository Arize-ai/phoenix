import { act, startTransition, Suspense, useEffect, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { RelayEnvironmentProvider } from "react-relay";
import { MemoryRouter } from "react-router";
import type { OperationDescriptor } from "relay-runtime";
import { createMockEnvironment, MockPayloadGenerator } from "relay-test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { installTestMatchMedia } from "@phoenix/__tests__/installTestMatchMedia";
import { installTestStorage } from "@phoenix/__tests__/installTestStorage";
import {
  TimeRangeProvider,
  type TimeRangeContextType,
  useTimeRange,
} from "@phoenix/components/datetime";
import { PreferencesProvider, ThemeProvider } from "@phoenix/contexts";
import { AgentProvider } from "@phoenix/contexts/AgentContext";

import {
  EvaluationQueueSizeTimeSeries,
  EvaluationsByEvaluatorTimeSeries,
} from "../EvaluatorActivityCharts";
import { MetricFetchKeyProvider } from "../types";
import { useClosedTimeRange } from "../useClosedTimeRange";

installTestMatchMedia();
installTestStorage();

const PROJECT_ID = "UHJvamVjdDox";
const ACTIVITY_QUERY = "EvaluatorActivityChartsQuery";
/** Five seconds past the hour, so a few refreshes cross a minute. */
const START_TIME = new Date("2026-01-01T12:00:05.000Z").getTime();
/** How often the project page refreshes while it streams. */
const TICK_MS = 10_000;

type StripControls = {
  /** A stream refresh: the live range moves to now and the fetch key changes. */
  tick: () => void;
  setTimeRange: TimeRangeContextType["setTimeRange"];
  setCustomTimeRange: TimeRangeContextType["setCustomTimeRange"];
  setTableText: (text: string) => void;
  setProjectId: (projectId: string) => void;
  timeRange: TimeRange;
};

let controls: StripControls;

/**
 * The evaluator charts as the evaluators tab strip renders them: on the page's
 * closed time range, refetching on the stream's fetch key, beside a stand-in
 * for the table that updates in the same transition as a stream refresh.
 */
function EvaluatorCharts() {
  const timeRange = useClosedTimeRange();
  const { refreshLiveTimeRange, setTimeRange, setCustomTimeRange } =
    useTimeRange();
  const [stream, setStream] = useState({ count: 0, tableText: "first rows" });
  const [projectId, setProjectId] = useState(PROJECT_ID);
  useEffect(() => {
    controls = {
      tick: () =>
        startTransition(() => {
          refreshLiveTimeRange();
          setStream((state) => ({ ...state, count: state.count + 1 }));
        }),
      setTimeRange,
      setCustomTimeRange,
      setTableText: (tableText) =>
        startTransition(() => {
          refreshLiveTimeRange();
          setStream((state) => ({ count: state.count + 1, tableText }));
        }),
      setProjectId: (nextProjectId) =>
        startTransition(() => setProjectId(nextProjectId)),
      timeRange,
    };
  });
  return (
    <Suspense fallback={<div>loading</div>}>
      <div data-testid="table">{stream.tableText}</div>
      <MetricFetchKeyProvider value={`stream-${stream.count}`}>
        <EvaluationsByEvaluatorTimeSeries
          projectId={projectId}
          timeRange={timeRange}
        />
        <EvaluationQueueSizeTimeSeries
          projectId={projectId}
          timeRange={timeRange}
        />
      </MetricFetchKeyProvider>
    </Suspense>
  );
}

let container: HTMLDivElement;
let root: Root;
let environment: ReturnType<typeof createMockEnvironment>;
let sentOperations: OperationDescriptor[];

function getOperationName(operation: OperationDescriptor) {
  return operation.request.node.params.name;
}

function getPendingOperations(name?: string) {
  return environment.mock
    .getAllOperations()
    .filter(
      (operation) => name == null || getOperationName(operation) === name
    );
}

/** The activity and queue size the server reports, empty or with one evaluator. */
function makeResponse(operation: OperationDescriptor, isEmpty: boolean) {
  const end = String(operation.request.variables.timeRange.end);
  return MockPayloadGenerator.generate(operation, {
    Node: () => ({
      __typename: "Project",
      id: String(operation.request.variables.projectId),
    }),
    EvaluationActivity: () =>
      isEmpty
        ? { groups: [], series: [] }
        : {
            groups: [
              {
                projectEvaluator: { id: "evaluator-1", name: "correctness" },
                evaluatedCount: 3,
                failedCount: 0,
                cost: 0,
              },
            ],
            series: [
              {
                timestamp: end,
                queueSize: 2,
                groups: [
                  {
                    projectEvaluator: { id: "evaluator-1" },
                    evaluatedCount: 3,
                    failedCount: 0,
                    lagP95Seconds: 1,
                    cost: 0,
                  },
                ],
              },
            ],
          },
  });
}

/** Answers the given requests, recording each one. */
async function resolveOperations(
  operations: OperationDescriptor[],
  { isEmpty = false }: { isEmpty?: boolean } = {}
) {
  await act(async () => {
    for (const operation of operations) {
      sentOperations.push(operation);
      environment.mock.resolve(operation, makeResponse(operation, isEmpty));
    }
  });
}

/** Answers every pending request, and any it leads to. */
async function resolvePendingRequests(options?: { isEmpty?: boolean }) {
  for (;;) {
    const pending = getPendingOperations();
    if (pending.length === 0) {
      return;
    }
    await resolveOperations(pending, options);
  }
}

async function tick() {
  vi.setSystemTime(Date.now() + TICK_MS);
  await act(async () => controls.tick());
}

function countSkeletons() {
  return container.querySelectorAll(".chart-skeleton").length;
}

/** How many of the two charts draw data rather than their empty state. */
function countChartsWithData() {
  return [...container.querySelectorAll(".chart-empty-state-overlay")].filter(
    (overlay) => overlay.getAttribute("data-empty") !== "true"
  ).length;
}

async function renderCharts(
  search: string,
  options: { isFirstResponseEmpty?: boolean } = {}
) {
  await act(async () => {
    root.render(
      <MemoryRouter
        initialEntries={[`/projects/${PROJECT_ID}/evaluators?${search}`]}
      >
        <PreferencesProvider>
          <AgentProvider>
            <TimeRangeProvider>
              <RelayEnvironmentProvider environment={environment}>
                <ThemeProvider>
                  <EvaluatorCharts />
                </ThemeProvider>
              </RelayEnvironmentProvider>
            </TimeRangeProvider>
          </AgentProvider>
        </PreferencesProvider>
      </MemoryRouter>
    );
  });
  await resolvePendingRequests({ isEmpty: options.isFirstResponseEmpty });
  sentOperations = [];
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(START_TIME);
  environment = createMockEnvironment();
  sentOperations = [];
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

describe("evaluator activity charts", () => {
  it("request the activity once when a stream advance moves the live range", async () => {
    await renderCharts("timeRangeKey=1h");
    await tick();
    await resolvePendingRequests();

    const activityRequests = sentOperations.filter(
      (operation) => getOperationName(operation) === ACTIVITY_QUERY
    );
    expect(activityRequests).toHaveLength(1);
    expect(activityRequests[0]?.request.variables.timeRange).toEqual({
      start: controls.timeRange.start.toISOString(),
      end: controls.timeRange.end.toISOString(),
    });
  });

  it("let the table's refresh commit while the activity request is pending", async () => {
    await renderCharts("timeRangeKey=1h");
    vi.setSystemTime(Date.now() + TICK_MS);
    await act(async () => controls.setTableText("refreshed rows"));

    expect(getPendingOperations(ACTIVITY_QUERY)).toHaveLength(1);
    expect(container.querySelector('[data-testid="table"]')?.textContent).toBe(
      "refreshed rows"
    );
    expect(container.textContent).not.toContain("loading");
  });

  it.each([
    ["Last 15 Min", "timeRangeKey=15m"],
    ["Last Hour", "timeRangeKey=1h"],
    [
      "a custom range",
      "timeRangeStart=2026-01-01T09:00:00.000Z&timeRangeEnd=2026-01-01T11:30:00.000Z",
    ],
  ])(
    "keep showing the charts on every stream refresh of %s",
    async (_name, search) => {
      await renderCharts(search);
      expect(countChartsWithData()).toBe(2);

      // Nine refreshes, across a minute
      for (let refresh = 0; refresh < 9; refresh++) {
        await tick();
        expect(getPendingOperations()).toHaveLength(2);
        expect(countSkeletons()).toBe(0);
        expect(countChartsWithData()).toBe(2);
        await resolvePendingRequests();
        expect(countSkeletons()).toBe(0);
      }
    }
  );

  it.each([
    [
      "another preset",
      () =>
        controls.setTimeRange({ timeRangeKey: "1h", start: null, end: null }),
    ],
    [
      "a range of the same length, earlier",
      () =>
        controls.setCustomTimeRange({
          start: new Date(controls.timeRange.start.getTime() - 15 * 60_000),
          end: new Date(controls.timeRange.end.getTime() - 15 * 60_000),
        }),
    ],
    ["another project", () => controls.setProjectId("UHJvamVjdDoy")],
  ])(
    "show a skeleton, not the previous range's data, while %s loads",
    async (_name, changeRange) => {
      await renderCharts("timeRangeKey=15m");
      await act(async () => changeRange());

      expect(countSkeletons()).toBe(2);

      await resolvePendingRequests();

      expect(countSkeletons()).toBe(0);
      expect(countChartsWithData()).toBe(2);
    }
  );
});
