import { act, Suspense } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  loadQuery,
  type PreloadedQuery,
  RelayEnvironmentProvider,
  usePreloadedQuery,
} from "react-relay";
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

installTestMatchMedia();

const authFetchMock = vi.hoisted(() => vi.fn());

vi.mock("@phoenix/authFetch", () => ({
  authFetch: authFetchMock,
}));

const TIME_RANGE = {
  start: "2026-07-01T00:00:00.000Z",
  end: "2026-07-02T00:00:00.000Z",
};

/** The picked time range, which a test can change. */
const timeRangeStore = vi.hoisted(() => {
  let timeRange = {
    selectionKey: "1d",
    timeRangeISOStrings: {
      start: "2026-07-01T00:00:00.000Z",
      end: "2026-07-02T00:00:00.000Z",
    },
  };
  const listeners = new Set<() => void>();
  return {
    getTimeRange: () => timeRange,
    setTimeRange: (nextTimeRange: typeof timeRange) => {
      timeRange = nextTimeRange;
      listeners.forEach((listener) => listener());
    },
    reset: () => {
      timeRange = {
        selectionKey: "1d",
        timeRangeISOStrings: {
          start: "2026-07-01T00:00:00.000Z",
          end: "2026-07-02T00:00:00.000Z",
        },
      };
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
  const useTimeRangeState = () =>
    React.useSyncExternalStore(
      timeRangeStore.subscribe,
      timeRangeStore.getTimeRange
    );
  return {
    ...(await importOriginal<typeof DateTimeModule>()),
    useTimeRange: () => ({
      timeRangeISOStrings: useTimeRangeState().timeRangeISOStrings,
    }),
    useTimeRangeSelectionKey: () => useTimeRangeState().selectionKey,
  };
});

/** The page's refresh key, which a test advances to make the table refetch. */
const streamState = vi.hoisted(() => {
  let keys = { fetchKey: "initial", throttledFetchKey: "initial" };
  const listeners = new Set<() => void>();
  return {
    getKeys: () => keys,
    /** New data: the rows refetch. */
    setFetchKey: (fetchKey: string) => {
      keys = { ...keys, fetchKey };
      listeners.forEach((listener) => listener());
    },
    /** The aggregates' refresh: the throttled key catches up. */
    throttle: () => {
      keys = { ...keys, throttledFetchKey: keys.fetchKey };
      listeners.forEach((listener) => listener());
    },
    reset: () => {
      keys = { fetchKey: "initial", throttledFetchKey: "initial" };
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

/** Every column but the name and the `correctness` annotation stays hidden. */
const tracingState = vi.hoisted(() => ({
  annotationColumnVisibility: { correctness: true },
  columnOrder: [],
  columnSizing: {},
  columnVisibility: Object.fromEntries(
    [
      "statusCode",
      "spanKind",
      "spanId",
      "traceId",
      "input_value",
      "output_value",
      "modelName",
      "error",
      "spanNotes",
      "traceNotes",
      "metadata",
      "userId",
      "annotations",
      "traceAnnotations",
      "startTime",
      "latencyMs",
      "cumulativeTokenCountTotal",
      "cumulativeTokenCostTotal",
    ].map((columnId) => [columnId, false])
  ),
  projectId: "UHJvamVjdDox",
  setColumnOrder: () => {},
  setColumnSizing: () => {},
  traceAnnotationColumnVisibility: {},
}));

vi.mock("@phoenix/contexts/TracingContext", () => ({
  useTracingContext: (selector: (state: typeof tracingState) => unknown) =>
    selector(tracingState),
}));

vi.mock("@phoenix/pages/trace/TracePaginationContext", () => ({
  useTracePagination: () => null,
}));

vi.mock("../SpanFiltersContext", () => ({
  useSpanFilterActions: () => ({
    persistToUrl: false,
    appendFilterCondition: () => {},
  }),
}));

/** The filter field's callback, which a test calls to apply a filter. */
const filterField = vi.hoisted(() => ({
  onValidCondition: null as
    | ((args: SpanFilterValidConditionArgs) => void)
    | null,
}));

vi.mock("../SpanFilterConditionField", () => ({
  SpanFilterConditionField: ({
    onValidCondition,
  }: {
    onValidCondition: (args: SpanFilterValidConditionArgs) => void;
  }) => {
    filterField.onValidCondition = onValidCondition;
    return null;
  },
}));

vi.mock("../SpansTableAside", () => ({
  SpansTableAside: () => null,
}));

vi.mock("../TableAside", async () => {
  const React = await import("react");
  return {
    TableAsidePanel: ({ children }: { children: React.ReactNode }) =>
      React.createElement("div", null, children),
    TableAsideToggleButton: () => null,
  };
});

vi.mock("../TableMetricsCharts", async () => {
  const React = await import("react");
  return {
    TableMetricsChartsPanelGroup: ({
      children,
    }: {
      children: React.ReactNode;
    }) => React.createElement("div", null, children),
  };
});

vi.mock("../TableMetricsChartSelector", () => ({
  TableMetricsChartSelector: () => null,
}));

import { fetchRelay } from "@phoenix/RelayEnvironment";

import type { ProjectPageQueriesSpansQuery as ProjectPageSpansQueryType } from "../__generated__/ProjectPageQueriesSpansQuery.graphql";
import { ProjectPageQueriesSpansQuery } from "../ProjectPageQueries";
import type { SpanFilterValidConditionArgs } from "../SpanFilterConditionField";
import type { SettledSpanFilterSeed } from "../spanFilterSeed";
import { SpansTable } from "../SpansTable";

const PROJECT_ID = tracingState.projectId;
const SEED: SettledSpanFilterSeed = {
  condition: "",
  requiresServerValidation: false,
  rootSpansOnly: true,
};
/** The label the spans query gives the deferred annotation names. */
const DEFER_LABEL = /@defer\(label: "([^"]+)"\)/.exec(
  getRequest(ProjectPageQueriesSpansQuery).params.text ?? ""
)?.[1];

function makeSpanEdge(index: number) {
  const id = `Span:${index}`;
  return {
    span: {
      __typename: "Span",
      id,
      spanKind: "llm",
      name: `span-${index}`,
      metadata: null,
      userId: null,
      modelName: null,
      statusCode: "OK",
      statusMessage: "",
      startTime: "2026-07-01T12:00:00+00:00",
      latencyMs: 10,
      cumulativeTokenCountTotal: 0,
      spanId: `span-id-${index}`,
      trace: {
        id: `Trace:${index}`,
        traceId: `trace-id-${index}`,
        costSummary: { total: { cost: null } },
        traceAnnotationSummaries: [],
        summaryTraceAnnotations: [],
        summaryTraceAnnotationSummaries: [],
      },
      input: { value: "" },
      output: { value: "" },
      spanAnnotations: [],
      documentRetrievalMetrics: [],
      summarySpanAnnotations: [],
      summarySpanAnnotationSummaries: [],
    },
    cursor: `cursor-${index}`,
    node: { __typename: "Span", id },
  };
}

/** The first part of the spans query's response: the rows, names deferred. */
const ROWS_PART = {
  data: {
    project: {
      __typename: "Project",
      id: PROJECT_ID,
      name: "project",
      evaluators: { edges: [] },
      configsByName: { edges: [] },
      spans: {
        edges: [makeSpanEdge(1), makeSpanEdge(2)],
        pageInfo: { endCursor: "cursor-2", hasNextPage: false },
      },
    },
  },
  hasNext: true,
  pending: [{ id: "0", path: ["project"], label: DEFER_LABEL }],
};

const NAMES_PART = {
  hasNext: false,
  incremental: [
    {
      id: "0",
      data: {
        spanAnnotationNames: ["correctness", "note"],
        traceAnnotationNames: ["trace-check"],
      },
    },
  ],
  completed: [{ id: "0" }],
};

function TableOwner({
  queryRef,
}: {
  queryRef: PreloadedQuery<ProjectPageSpansQueryType>;
}) {
  const data = usePreloadedQuery<ProjectPageSpansQueryType>(
    ProjectPageQueriesSpansQuery,
    queryRef
  );
  return (
    <SpansTable
      project={data.project}
      seed={SEED}
      initialRequest={queryRef.source}
    />
  );
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  authFetchMock.mockReset();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

async function renderTable() {
  const environment = new Environment({
    network: Network.create(fetchRelay),
    store: new Store(new RecordSource()),
  });
  const queryRef = loadQuery<ProjectPageSpansQueryType>(
    environment,
    ProjectPageQueriesSpansQuery,
    {
      id: PROJECT_ID,
      timeRange: TIME_RANGE,
      filterCondition: null,
      rootSpansOnly: SEED.rootSpansOnly,
    }
  );
  await act(async () => {
    root.render(
      <ThemeProvider themeMode="light" disableBodyTheme>
        <PreferencesProvider>
          <RelayEnvironmentProvider environment={environment}>
            <MemoryRouter initialEntries={[`/projects/${PROJECT_ID}/spans`]}>
              <Suspense fallback="loading">
                <TableOwner queryRef={queryRef} />
              </Suspense>
            </MemoryRouter>
          </RelayEnvironmentProvider>
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

/** Opens the column selector and lists the failed states in it. */
async function readColumnSelectorFailures() {
  const columnsButton = [...container.querySelectorAll("button")].find(
    (button) => button.textContent === "Columns"
  );
  await act(async () => {
    columnsButton?.click();
  });
  const popover = document.querySelector(".react-aria-Popover");
  return [...(popover?.querySelectorAll("*") ?? [])]
    .filter(
      (element) =>
        element.children.length === 0 &&
        element.textContent?.endsWith("failed to load.")
    )
    .map((element) => element.textContent);
}

/** A response to a rows refetch or next page: the rows, no names. */
function makeRowsResponse(indexes: number[]) {
  return new Response(
    JSON.stringify({
      data: {
        node: {
          ...ROWS_PART.data.project,
          spans: {
            edges: indexes.map(makeSpanEdge),
            pageInfo: {
              endCursor: `cursor-${indexes.at(-1)}`,
              hasNextPage: false,
            },
          },
        },
      },
    }),
    { headers: { "Content-Type": "application/json" } }
  );
}

/** A response to the names-only refresh. */
function makeNamesResponse(spanAnnotationNames: string[]) {
  return new Response(
    JSON.stringify({
      data: {
        node: {
          __typename: "Project",
          id: PROJECT_ID,
          spanAnnotationNames,
          traceAnnotationNames: [],
        },
      },
    }),
    { headers: { "Content-Type": "application/json" } }
  );
}

function readRequest(call: number): { query: string } {
  return JSON.parse(authFetchMock.mock.calls[call][1].body);
}

function readRowNames() {
  return [...container.querySelectorAll("tbody tr")].map(
    (row) => row.textContent
  );
}

function readColumnHeaders() {
  return [...container.querySelectorAll("thead th")].map(
    (header) => header.textContent
  );
}

/** Answers each later request by what it asks for: rows, or names alone. */
function answerRequests({
  rows,
  names = [],
}: {
  rows: number[];
  names?: string[];
}) {
  authFetchMock.mockImplementation(
    async (_url: string, init: { body: string }) => {
      const { query } = JSON.parse(init.body);
      return query.includes("useSpanAnnotationNamesRefreshQuery")
        ? makeNamesResponse(names)
        : makeRowsResponse(rows);
    }
  );
}

/** The names-only refresh requests sent after the page's first request. */
function readNamesRefreshCount() {
  return authFetchMock.mock.calls
    .slice(1)
    .filter(([, init]) =>
      JSON.parse(init.body).query.includes("useSpanAnnotationNamesRefreshQuery")
    ).length;
}

describe("SpansTable annotation names while the stream advances", () => {
  beforeEach(() => {
    streamState.reset();
    timeRangeStore.reset();
  });

  async function renderLoadedTable() {
    const load = createStreamingMultipartResponse();
    authFetchMock.mockResolvedValueOnce(load.response);
    await renderTable();
    load.sendPart(ROWS_PART);
    load.sendPart(NAMES_PART);
    load.end();
    await settle();
  }

  it("refetches the rows on every advance without the names, which stay on screen", async () => {
    await renderLoadedTable();
    answerRequests({ rows: [3, 4] });
    await act(async () => streamState.setFetchKey("advance-1"));
    await settle();
    answerRequests({ rows: [5] });
    await act(async () => streamState.setFetchKey("advance-2"));
    await settle();

    expect(authFetchMock).toHaveBeenCalledTimes(3);
    for (const call of [1, 2]) {
      expect(readRequest(call).query).not.toContain("spanAnnotationNames");
    }
    expect(readRowNames()).toEqual(["span-5"]);
    expect(readColumnHeaders()).toContain("correctness");
  });

  it("refreshes the names on the throttled fetch key, not on mount", async () => {
    await renderLoadedTable();
    expect(authFetchMock).toHaveBeenCalledTimes(1);
    answerRequests({ rows: [1, 2], names: ["helpfulness"] });

    await act(async () => {
      streamState.setFetchKey("advance-1");
      streamState.throttle();
    });
    await settle();

    expect(readNamesRefreshCount()).toBe(1);
    expect(readColumnHeaders()).not.toContain("correctness");
  });

  it("does not refresh the names when the table mounts after the throttled fetch key moved", async () => {
    streamState.setFetchKey("advance-1");
    streamState.throttle();
    await renderLoadedTable();

    expect(readNamesRefreshCount()).toBe(0);
  });

  it("refreshes the names once after their payload fails", async () => {
    const load = createStreamingMultipartResponse();
    authFetchMock.mockResolvedValueOnce(load.response);
    await renderTable();
    load.sendPart(ROWS_PART);
    answerRequests({ rows: [1, 2], names: ["correctness"] });
    load.sendPart({
      hasNext: false,
      completed: [
        { id: "0", errors: [{ message: "an unexpected error occurred" }] },
      ],
    });
    load.end();
    await settle();

    expect(readNamesRefreshCount()).toBe(1);
    expect(readColumnHeaders()).toContain("correctness");
    expect(await readColumnSelectorFailures()).toEqual([]);
  });

  it.each([
    {
      change: "a filter is applied",
      applyChange: () =>
        filterField.onValidCondition?.({
          condition: "span_kind == 'LLM'",
          selectsRootSpansOnly: true,
          isInitialSettlement: false,
        }),
    },
    {
      change: "another time range is picked",
      applyChange: () =>
        timeRangeStore.setTimeRange({
          selectionKey: "7d",
          timeRangeISOStrings: {
            start: "2026-06-25T00:00:00.000Z",
            end: "2026-07-02T00:00:00.000Z",
          },
        }),
    },
  ])(
    "does not refresh the project-wide names when $change",
    async ({ applyChange }) => {
      await renderLoadedTable();
      answerRequests({ rows: [1], names: ["helpfulness"] });
      await act(async () => applyChange());
      await settle();

      expect(readNamesRefreshCount()).toBe(0);
      expect(readColumnHeaders()).toContain("correctness");
    }
  );

  it("keeps one names refresh in flight however often the throttled fetch key moves", async () => {
    await renderLoadedTable();
    const namesRefreshSignals: AbortSignal[] = [];
    authFetchMock.mockImplementation(
      async (_url: string, init: { body: string; signal: AbortSignal }) => {
        if (
          JSON.parse(init.body).query.includes(
            "useSpanAnnotationNamesRefreshQuery"
          )
        ) {
          namesRefreshSignals.push(init.signal);
          return new Promise<Response>(() => {});
        }
        return makeRowsResponse([1, 2]);
      }
    );
    for (const fetchKey of ["advance-1", "advance-2", "advance-3"]) {
      await act(async () => {
        streamState.setFetchKey(fetchKey);
        streamState.throttle();
      });
      await settle();
    }

    expect(namesRefreshSignals).toHaveLength(1);
    expect(namesRefreshSignals[0].aborted).toBe(false);
  });

  it("does not refresh the names while their deferred payload is loading", async () => {
    const load = createStreamingMultipartResponse();
    authFetchMock.mockResolvedValueOnce(load.response);
    await renderTable();
    load.sendPart(ROWS_PART);
    await settle();
    answerRequests({ rows: [1, 2], names: ["helpfulness"] });
    await act(async () => {
      streamState.setFetchKey("advance-1");
      streamState.throttle();
    });
    await settle();
    load.sendPart(NAMES_PART);
    load.end();
    await settle();

    expect(readNamesRefreshCount()).toBe(0);
    expect(readColumnHeaders()).toContain("correctness");
  });

  it("keeps the names on screen and reports a names refresh that fails", async () => {
    await renderLoadedTable();
    authFetchMock.mockImplementation(
      async (_url: string, init: { body: string }) =>
        JSON.parse(init.body).query.includes(
          "useSpanAnnotationNamesRefreshQuery"
        )
          ? new Response(
              JSON.stringify({
                data: null,
                errors: [{ message: "an unexpected error occurred" }],
              }),
              { headers: { "Content-Type": "application/json" } }
            )
          : makeRowsResponse([1, 2])
    );
    await act(async () => {
      streamState.setFetchKey("advance-1");
      streamState.throttle();
    });
    await settle();

    expect(readNamesRefreshCount()).toBe(1);
    expect(readColumnHeaders()).toContain("correctness");
    expect(await readColumnSelectorFailures()).toEqual([
      "Span annotation names failed to load.",
      "Trace annotation names failed to load.",
    ]);
  });
});

const sentinel = { isVisible: false };
class VisibleSentinelObserver {
  constructor(private callback: IntersectionObserverCallback) {}
  observe() {
    queueMicrotask(() =>
      this.callback(
        [{ isIntersecting: sentinel.isVisible } as IntersectionObserverEntry],
        this as unknown as IntersectionObserver
      )
    );
  }
  disconnect() {}
}

describe("SpansTable next page while the names load", () => {
  beforeEach(() => {
    vi.stubGlobal("IntersectionObserver", VisibleSentinelObserver);
    streamState.reset();
    timeRangeStore.reset();
    sentinel.isVisible = true;
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads the next page once the names arrive when the sentinel is in view", async () => {
    const load = createStreamingMultipartResponse();
    const nextPage = createStreamingMultipartResponse();
    authFetchMock
      .mockResolvedValueOnce(load.response)
      .mockResolvedValueOnce(nextPage.response);
    await renderTable();
    load.sendPart({
      ...ROWS_PART,
      data: {
        project: {
          ...ROWS_PART.data.project,
          spans: {
            ...ROWS_PART.data.project.spans,
            pageInfo: { endCursor: "cursor-2", hasNextPage: true },
          },
        },
      },
    });
    await settle();
    // Relay does not load a next page while the names are pending.
    expect(authFetchMock).toHaveBeenCalledTimes(1);

    load.sendPart(NAMES_PART);
    load.end();
    await settle();

    expect(authFetchMock).toHaveBeenCalledTimes(2);
    const { variables } = JSON.parse(authFetchMock.mock.calls[1][1].body);
    expect(variables).toMatchObject({ after: "cursor-2" });
  });
});
