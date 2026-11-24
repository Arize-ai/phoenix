import { act, Suspense } from "react";
import { createRoot, type Root } from "react-dom/client";
import { RelayEnvironmentProvider } from "react-relay";
import { MemoryRouter, Route, Routes } from "react-router";
import { createMockEnvironment, MockPayloadGenerator } from "relay-test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type * as DateTimeModule from "@phoenix/components/datetime";

const TIME_RANGE = {
  start: "2026-07-01T00:00:00.000Z",
  end: "2026-07-02T00:00:00.000Z",
};

/** The aggregates' fetch key, which a test moves as the provider's tick does. */
const streamState = vi.hoisted(() => {
  let keys = { throttledFetchKey: "initial" };
  const listeners = new Set<() => void>();
  return {
    getKeys: () => keys,
    setThrottledFetchKey: (throttledFetchKey: string) => {
      keys = { throttledFetchKey };
      listeners.forEach((listener) => listener());
    },
    reset: () => {
      keys = { throttledFetchKey: "initial" };
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
});

vi.mock("@phoenix/contexts/StreamStateContext", async () => {
  const React = await import("react");
  return {
    useStreamState: () =>
      React.useSyncExternalStore(streamState.subscribe, streamState.getKeys),
  };
});

vi.mock("@phoenix/components/datetime", async (importOriginal) => ({
  ...(await importOriginal<typeof DateTimeModule>()),
  useTimeRange: () => ({ timeRangeISOStrings: TIME_RANGE }),
}));

import { DocumentEvaluationSummary } from "../DocumentEvaluationSummary";

const PROJECT_ID = "UHJvamVjdDox";

let container: HTMLDivElement;
let root: Root;
let environment: ReturnType<typeof createMockEnvironment>;

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  streamState.reset();
  environment = createMockEnvironment();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function renderSummary({ isMounted = true }: { isMounted?: boolean } = {}) {
  act(() =>
    root.render(
      <RelayEnvironmentProvider environment={environment}>
        <MemoryRouter initialEntries={[`/projects/${PROJECT_ID}/spans`]}>
          <Routes>
            <Route
              path="/projects/:projectId/spans"
              element={
                <Suspense fallback="loading">
                  {isMounted ? (
                    <DocumentEvaluationSummary evaluationName="relevance" />
                  ) : null}
                </Suspense>
              }
            />
          </Routes>
        </MemoryRouter>
      </RelayEnvironmentProvider>
    )
  );
}

async function resolveSummary({ hitRate }: { hitRate: number }) {
  await act(async () =>
    environment.mock.resolveMostRecentOperation((operation) =>
      MockPayloadGenerator.generate(operation, {
        Node: () => ({ __typename: "Project", id: PROJECT_ID }),
        DocumentEvaluationSummary: () => ({
          averageNdcg: null,
          averagePrecision: null,
          meanReciprocalRank: null,
          hitRate,
        }),
      })
    )
  );
}

function countPendingRequests() {
  return environment.mock.getAllOperations().length;
}

describe("DocumentEvaluationSummary", () => {
  it("sends one request when the aggregates' fetch key moves", async () => {
    renderSummary();
    expect(countPendingRequests()).toBe(1);
    await resolveSummary({ hitRate: 0.25 });

    act(() => streamState.setThrottledFetchKey("tick-1"));

    expect(countPendingRequests()).toBe(1);
  });

  it("shows the stored summary and refreshes it when it mounts again", async () => {
    renderSummary();
    await resolveSummary({ hitRate: 0.25 });
    renderSummary({ isMounted: false });
    renderSummary();

    expect(container.textContent).toContain("0.25");
    expect(countPendingRequests()).toBe(1);

    await resolveSummary({ hitRate: 0.75 });

    expect(container.textContent).toContain("0.75");
  });
});
