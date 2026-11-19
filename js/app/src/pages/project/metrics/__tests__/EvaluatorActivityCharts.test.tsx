import { act, startTransition, Suspense, useEffect, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { RelayEnvironmentProvider } from "react-relay";
import type { OperationDescriptor } from "relay-runtime";
import { createMockEnvironment, MockPayloadGenerator } from "relay-test-utils";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { installTestMatchMedia } from "@phoenix/__tests__/installTestMatchMedia";
import { installTestStorage } from "@phoenix/__tests__/installTestStorage";
import { PreferencesProvider, ThemeProvider } from "@phoenix/contexts";

import {
  EvaluationQueueSizeTimeSeries,
  EvaluationsByEvaluatorTimeSeries,
} from "../EvaluatorActivityCharts";
import { MetricFetchKeyProvider } from "../types";

installTestMatchMedia();
installTestStorage();

const ACTIVITY_QUERY = "EvaluatorActivityChartsQuery";

const FIRST_RANGE = {
  start: new Date("2026-01-01T00:00:00.000Z"),
  end: new Date("2026-01-01T06:00:00.000Z"),
};
const LATER_RANGE = {
  start: FIRST_RANGE.start,
  end: new Date("2026-01-01T06:00:20.000Z"),
};
const LONGER_RANGE = {
  start: new Date("2025-12-25T06:00:00.000Z"),
  end: FIRST_RANGE.end,
};

type ChartsState = {
  timeRange: TimeRange;
  fetchKey: string;
  tableText: string;
};

let setChartsState: (update: (state: ChartsState) => ChartsState) => void;

/**
 * The evaluator charts as the evaluators tab strip renders them, beside a
 * stand-in for the table that updates in the same transition.
 */
function EvaluatorCharts() {
  const [state, setState] = useState<ChartsState>({
    timeRange: FIRST_RANGE,
    fetchKey: "stream-1",
    tableText: "first rows",
  });
  useEffect(() => {
    setChartsState = setState;
  }, []);
  return (
    <Suspense fallback={<div>loading</div>}>
      <div data-testid="table">{state.tableText}</div>
      <MetricFetchKeyProvider value={state.fetchKey}>
        <EvaluationsByEvaluatorTimeSeries
          projectId="UHJvamVjdDox"
          timeRange={state.timeRange}
        />
        <EvaluationQueueSizeTimeSeries
          projectId="UHJvamVjdDox"
          timeRange={state.timeRange}
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

/** Answers every pending request, and any it leads to, recording each one. */
async function resolvePendingRequests() {
  for (;;) {
    const pending = environment.mock.getAllOperations();
    if (pending.length === 0) {
      return;
    }
    await act(async () => {
      for (const operation of pending) {
        sentOperations.push(operation);
        environment.mock.resolve(
          operation,
          MockPayloadGenerator.generate(operation, {
            Node: () => ({ __typename: "Project" }),
            EvaluationActivity: () => ({ groups: [], series: [] }),
          })
        );
      }
    });
  }
}

async function update(change: Partial<ChartsState>) {
  await act(async () => {
    startTransition(() => setChartsState((state) => ({ ...state, ...change })));
  });
}

beforeEach(async () => {
  environment = createMockEnvironment();
  sentOperations = [];
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(
      <RelayEnvironmentProvider environment={environment}>
        <PreferencesProvider>
          <ThemeProvider>
            <EvaluatorCharts />
          </ThemeProvider>
        </PreferencesProvider>
      </RelayEnvironmentProvider>
    );
  });
  await resolvePendingRequests();
  sentOperations = [];
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("evaluator activity charts", () => {
  it("request the activity once when a stream advance moves the live range", async () => {
    await update({ timeRange: LATER_RANGE, fetchKey: "stream-2" });
    await resolvePendingRequests();

    const activityRequests = sentOperations.filter(
      (operation) => getOperationName(operation) === ACTIVITY_QUERY
    );
    expect(activityRequests).toHaveLength(1);
    expect(activityRequests[0]?.request.variables.timeRange).toEqual({
      start: LATER_RANGE.start.toISOString(),
      end: LATER_RANGE.end.toISOString(),
    });
  });

  it("let the table's refresh commit while the activity request is pending", async () => {
    await update({
      timeRange: LATER_RANGE,
      fetchKey: "stream-2",
      tableText: "refreshed rows",
    });

    expect(
      environment.mock
        .getAllOperations()
        .some((operation) => getOperationName(operation) === ACTIVITY_QUERY)
    ).toBe(true);
    expect(container.querySelector('[data-testid="table"]')?.textContent).toBe(
      "refreshed rows"
    );
    expect(container.textContent).not.toContain("loading");
  });

  it("keep showing a chart while a stream advance loads", async () => {
    await update({ timeRange: LATER_RANGE, fetchKey: "stream-2" });

    expect(container.querySelectorAll(".chart-skeleton")).toHaveLength(0);
  });

  it("show a skeleton, not the previous range's data, while a range of another length loads", async () => {
    await update({ timeRange: LONGER_RANGE, tableText: "refreshed rows" });

    expect(container.querySelector('[data-testid="table"]')?.textContent).toBe(
      "refreshed rows"
    );
    expect(container.querySelectorAll(".chart-skeleton")).toHaveLength(2);

    await resolvePendingRequests();

    expect(container.querySelectorAll(".chart-skeleton")).toHaveLength(0);
  });
});
