import { act, startTransition, Suspense, use, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { RelayEnvironmentProvider } from "react-relay";
import { MemoryRouter } from "react-router";
import {
  Environment,
  getRequest,
  Network,
  RecordSource,
  Store,
} from "relay-runtime";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { installTestMatchMedia } from "@phoenix/__tests__/installTestMatchMedia";
import { createStreamingMultipartResponse } from "@phoenix/__tests__/multipartResponse";
import type * as DateTimeModule from "@phoenix/components/datetime";
import { PreferencesProvider, ThemeProvider } from "@phoenix/contexts";
import {
  type StreamStateContextType,
  StreamStateProvider,
  useStreamState,
} from "@phoenix/contexts/StreamStateContext";

installTestMatchMedia();

const authFetchMock = vi.hoisted(() => vi.fn());

vi.mock("@phoenix/authFetch", () => ({
  authFetch: authFetchMock,
}));

const TIME_RANGE = {
  start: "2026-07-01T00:00:00.000Z",
  end: "2026-07-02T00:00:00.000Z",
};

/** The page's time range, which a test can change. */
const timeRangeStore = vi.hoisted(() => {
  let timeRange = {
    start: "2026-07-01T00:00:00.000Z",
    end: "2026-07-02T00:00:00.000Z",
  };
  const listeners = new Set<() => void>();
  return {
    getTimeRange: () => timeRange,
    setTimeRange: (nextTimeRange: typeof timeRange) => {
      timeRange = nextTimeRange;
      listeners.forEach((listener) => listener());
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
});

vi.mock("@phoenix/components/datetime", async (importOriginal) => {
  const React = await import("react");
  return {
    ...(await importOriginal<typeof DateTimeModule>()),
    useTimeRange: () => ({
      timeRangeISOStrings: React.useSyncExternalStore(
        timeRangeStore.subscribe,
        timeRangeStore.getTimeRange
      ),
    }),
  };
});

const PROJECT_ID = "UHJvamVjdDox";

vi.mock("@phoenix/contexts/TracingContext", () => ({
  useTracingContext: (selector: (state: { projectId: string }) => unknown) =>
    selector({ projectId: PROJECT_ID }),
}));

import { fetchRelay } from "@phoenix/RelayEnvironment";

import SpansTableAsideQuery from "../__generated__/SpansTableAsideQuery.graphql";
import { SpansTableAside } from "../SpansTableAside";

/** The label the side panel's query gives the deferred totals. */
const TOTALS_DEFER_LABEL = /@defer\(label: "([^"]+)"\)/.exec(
  getRequest(SpansTableAsideQuery).params.text ?? ""
)?.[1];

/** The first part of the side panel's response: everything but the totals. */
const PANEL_PART = {
  data: {
    project: {
      __typename: "Project",
      id: PROJECT_ID,
      name: "project",
      description: null,
      traceAnnotationNames: [],
      documentEvaluationNames: [],
    },
  },
  hasNext: true,
  pending: [{ id: "totals", path: ["project"], label: TOTALS_DEFER_LABEL }],
};

/** The deferred totals part of the side panel's response. */
function getTotalsPart(timeRangeTraceCount: number) {
  return {
    hasNext: false,
    incremental: [
      {
        id: "totals",
        data: {
          timeRangeTraceCount,
          costSummary: {
            total: { cost: null },
            prompt: { cost: null },
            completion: { cost: null },
          },
          latencyMsP50: null,
          latencyMsP99: null,
        },
      },
    ],
    completed: [{ id: "totals" }],
  };
}

const TOTALS_PART = getTotalsPart(1234);

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  authFetchMock.mockReset();
  timeRangeStore.setTimeRange(TIME_RANGE);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

/**
 * Suspends while `pending` is set, so the boundary around it hides the
 * panel and shows it again once it resolves.
 */
function SuspendingSibling({ pending }: { pending: Promise<void> | null }) {
  if (pending != null) {
    use(pending);
  }
  return null;
}

let streamState: StreamStateContextType;

function StreamStateProbe() {
  const state = useStreamState();
  useEffect(() => {
    streamState = state;
  }, [state]);
  return null;
}

async function renderAside({
  pendingSibling = null,
  traceStreamingEnabled = true,
}: {
  pendingSibling?: Promise<void> | null;
  traceStreamingEnabled?: boolean;
} = {}) {
  const environment = new Environment({
    network: Network.create(fetchRelay),
    store: new Store(new RecordSource()),
  });
  await act(async () => {
    root.render(
      <ThemeProvider themeMode="light" disableBodyTheme>
        <PreferencesProvider traceStreamingEnabled={traceStreamingEnabled}>
          <StreamStateProvider>
            <StreamStateProbe />
            <RelayEnvironmentProvider environment={environment}>
              <MemoryRouter>
                <Suspense fallback="loading">
                  <SuspendingSibling pending={pendingSibling} />
                  <SpansTableAside spanAnnotationNames={[]} />
                </Suspense>
              </MemoryRouter>
            </RelayEnvironmentProvider>
          </StreamStateProvider>
        </PreferencesProvider>
      </ThemeProvider>
    );
  });
}

/** Lets streamed parts reach Relay and React render what they wrote. */
async function settle() {
  await act(async () => {
    for (let turn = 0; turn < 10; turn++) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  });
}

/** Each stat's label and value, or the panel's message in their place. */
function readTotals() {
  const stats = [...container.querySelectorAll("h3")].map((label) => {
    // The stat is the nearest ancestor holding more than its label, which may
    // share a row with a help icon.
    let stat = label.parentElement;
    while (stat != null && stat.textContent === label.textContent) {
      stat = stat.parentElement;
    }
    return [
      label.textContent,
      stat?.textContent?.slice(label.textContent?.length ?? 0),
    ];
  });
  const failure = [...container.querySelectorAll("span")].find((element) =>
    element.textContent?.endsWith("failed to load.")
  )?.textContent;
  return failure ?? Object.fromEntries(stats);
}

describe("SpansTableAside totals", () => {
  it("shows the panel before its totals arrive", async () => {
    const stream = createStreamingMultipartResponse();
    authFetchMock.mockResolvedValueOnce(stream.response);
    await renderAside();
    stream.sendPart(PANEL_PART);
    await settle();

    expect(readTotals()).toEqual({
      "Total Traces": "--",
      "Total Cost": "--",
      "Latency P50": "--",
      "Latency P99": "--",
    });

    stream.sendPart(TOTALS_PART);
    stream.end();
    await settle();

    expect(authFetchMock).toHaveBeenCalledTimes(1);
    expect(readTotals()).toEqual({
      "Total Traces": "1,234",
      "Total Cost": "$0",
      "Latency P50": "--",
      "Latency P99": "--",
    });
  });

  it("keeps the previous totals on screen while a new time range's totals load", async () => {
    const load = createStreamingMultipartResponse();
    const nextLoad = createStreamingMultipartResponse();
    authFetchMock
      .mockResolvedValueOnce(load.response)
      .mockResolvedValueOnce(nextLoad.response);
    await renderAside();
    load.sendPart(PANEL_PART);
    load.sendPart(TOTALS_PART);
    load.end();
    await settle();

    await act(async () =>
      startTransition(() =>
        timeRangeStore.setTimeRange({
          start: "2026-07-02T00:00:00.000Z",
          end: "2026-07-03T00:00:00.000Z",
        })
      )
    );
    nextLoad.sendPart(PANEL_PART);
    await settle();

    expect(authFetchMock).toHaveBeenCalledTimes(2);
    expect(readTotals()).toMatchObject({ "Total Traces": "1,234" });
  });

  it("refreshes the totals at once after a trace transfer while streaming is paused", async () => {
    const load = createStreamingMultipartResponse();
    const nextLoad = createStreamingMultipartResponse();
    authFetchMock
      .mockResolvedValueOnce(load.response)
      .mockResolvedValueOnce(nextLoad.response);
    await renderAside({ traceStreamingEnabled: false });
    load.sendPart(PANEL_PART);
    load.sendPart(TOTALS_PART);
    load.end();
    await settle();

    await act(async () =>
      streamState.setFetchKey({ fetchKey: "trace-transfer-1" })
    );
    nextLoad.sendPart(PANEL_PART);
    nextLoad.sendPart(getTotalsPart(1200));
    nextLoad.end();
    await settle();

    expect(authFetchMock).toHaveBeenCalledTimes(2);
    expect(readTotals()).toMatchObject({ "Total Traces": "1,200" });
  });

  it.each([
    {
      failure: "a totals part that reports errors",
      fail: (stream: ReturnType<typeof createStreamingMultipartResponse>) => {
        stream.sendPart({
          hasNext: false,
          completed: [
            {
              id: "totals",
              errors: [{ message: "an unexpected error occurred" }],
            },
          ],
        });
        stream.end();
      },
    },
    {
      failure: "a response that ends before the totals",
      fail: (stream: ReturnType<typeof createStreamingMultipartResponse>) =>
        stream.cutOff(),
    },
  ])(
    "keeps the panel and says the totals failed to load after $failure",
    async ({ fail }) => {
      const stream = createStreamingMultipartResponse();
      authFetchMock.mockResolvedValueOnce(stream.response);
      await renderAside();
      stream.sendPart(PANEL_PART);
      await settle();

      fail(stream);
      await settle();

      expect(container.textContent).toContain("Project Info");
      expect(readTotals()).toBe(
        "Trace count, cost and latency failed to load."
      );
    }
  );

  it("reads a live reference after a boundary above hides the panel and shows it again", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const load = createStreamingMultipartResponse();
    authFetchMock.mockResolvedValueOnce(load.response);
    let resolveSibling = () => {};
    const pendingSibling = new Promise<void>((resolve) => {
      resolveSibling = resolve;
    });
    // The boundary shows its fallback and renders the panel hidden behind it
    // until the sibling resolves, then reveals it.
    await renderAside({ pendingSibling });
    await act(async () => resolveSibling());
    load.sendPart(PANEL_PART);
    load.sendPart(TOTALS_PART);
    load.end();
    await settle();

    const disposedWarnings = consoleError.mock.calls.filter((call) =>
      String(call[0]).includes("to not be disposed")
    );
    consoleError.mockRestore();
    expect(disposedWarnings).toEqual([]);
    expect(authFetchMock).toHaveBeenCalledTimes(1);
    expect(readTotals()).toMatchObject({ "Total Traces": "1,234" });
  });
});
