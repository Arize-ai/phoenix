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
const QUEUE_SIZE_QUERY = "EvaluatorQueueSizeChartQuery";
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

/**
 * Streams for `forMs`, a refresh every `TICK_MS`, answering each chart request
 * `durationMs` after it was sent, as a server whose chart queries are slower
 * than the stream.
 */
async function streamWithSlowCharts({
  durationMs,
  forMs,
}: {
  durationMs: number;
  forMs: number;
}) {
  const sentAt = new Map<OperationDescriptor, number>();
  const requests: OperationDescriptor[] = [];
  const maxPending = { [ACTIVITY_QUERY]: 0, [QUEUE_SIZE_QUERY]: 0 };
  const recordPending = () => {
    for (const operation of getPendingOperations()) {
      if (!sentAt.has(operation)) {
        sentAt.set(operation, Date.now());
        requests.push(operation);
      }
    }
    for (const name of [ACTIVITY_QUERY, QUEUE_SIZE_QUERY] as const) {
      maxPending[name] = Math.max(
        maxPending[name],
        getPendingOperations(name).length
      );
    }
  };
  for (let elapsedMs = 1_000; elapsedMs <= forMs; elapsedMs += 1_000) {
    vi.setSystemTime(START_TIME + elapsedMs);
    if (elapsedMs % TICK_MS === 0) {
      await act(async () => controls.tick());
    }
    recordPending();
    await resolveOperations(
      getPendingOperations().filter(
        (operation) => Date.now() - (sentAt.get(operation) ?? 0) >= durationMs
      )
    );
    recordPending();
  }
  const getRequestedEnds = (name: string) =>
    requests
      .filter((operation) => getOperationName(operation) === name)
      .map((operation) => String(operation.request.variables.timeRange.end));
  return { maxPending, getRequestedEnds };
}

describe("evaluator activity charts slower than the stream", () => {
  it("show each refresh that takes longer than the time between refreshes", async () => {
    await renderCharts("timeRangeKey=15m", { isFirstResponseEmpty: true });
    expect(countChartsWithData()).toBe(0);

    const { maxPending, getRequestedEnds } = await streamWithSlowCharts({
      durationMs: 15_000,
      forMs: 60_000,
    });

    expect(countChartsWithData()).toBe(2);
    expect(countSkeletons()).toBe(0);
    expect(maxPending).toEqual({ [ACTIVITY_QUERY]: 1, [QUEUE_SIZE_QUERY]: 1 });
    // Each one that finished was followed by the refresh that came meanwhile
    const answeredEnds = sentOperations
      .filter((operation) => getOperationName(operation) === ACTIVITY_QUERY)
      .map((operation) => String(operation.request.variables.timeRange.end));
    expect(answeredEnds.length).toBeGreaterThanOrEqual(3);
    expect(answeredEnds).toEqual(
      getRequestedEnds(ACTIVITY_QUERY).slice(0, answeredEnds.length)
    );
    expect([...answeredEnds].sort()).toEqual(answeredEnds);
  });

  it("follow a refresh that is loading with only the latest one that came meanwhile", async () => {
    await renderCharts("timeRangeKey=15m");

    // Refreshes at 10 s, 20 s and 30 s; the first takes until 35 s
    const { getRequestedEnds } = await streamWithSlowCharts({
      durationMs: 25_000,
      forMs: 36_000,
    });

    expect(getRequestedEnds(ACTIVITY_QUERY)).toEqual([
      new Date(START_TIME + 10_000).toISOString(),
      new Date(START_TIME + 30_000).toISOString(),
    ]);
  });

  it("replace a refresh that is loading when another range is chosen", async () => {
    await renderCharts("timeRangeKey=15m");
    await tick();
    const [refresh] = getPendingOperations(ACTIVITY_QUERY);

    await act(async () =>
      controls.setTimeRange({ timeRangeKey: "1h", start: null, end: null })
    );

    const pending = getPendingOperations(ACTIVITY_QUERY);
    expect(pending).toHaveLength(1);
    expect(pending[0]).not.toBe(refresh);
    expect(pending[0]?.request.variables.timeRange).toEqual({
      start: controls.timeRange.start.toISOString(),
      end: controls.timeRange.end.toISOString(),
    });
    expect(countSkeletons()).toBe(2);

    await resolvePendingRequests();

    expect(countSkeletons()).toBe(0);
    expect(countChartsWithData()).toBe(2);
  });
});
