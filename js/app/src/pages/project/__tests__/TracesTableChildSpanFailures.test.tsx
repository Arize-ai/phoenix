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

vi.mock("@phoenix/components/datetime", async (importOriginal) => ({
  ...(await importOriginal<typeof DateTimeModule>()),
  useTimeRange: () => ({ timeRangeISOStrings: TIME_RANGE }),
}));

/** The page's refresh key, which a test advances to make the table refetch. */
const streamState = vi.hoisted(() => {
  let fetchKey = 0;
  const listeners = new Set<() => void>();
  return {
    getFetchKey: () => fetchKey,
    setFetchKey: (nextFetchKey: number) => {
      fetchKey = nextFetchKey;
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

vi.mock("@phoenix/contexts/StreamStateContext", async () => {
  const React = await import("react");
  return {
    useStreamState: () => ({
      fetchKey: React.useSyncExternalStore(
        streamState.subscribe,
        streamState.getFetchKey
      ),
    }),
  };
});

/** Every column but the kind and the name stays hidden. */
const tracingState = vi.hoisted(() => ({
  annotationColumnVisibility: {},
  columnOrder: [],
  columnSizing: {},
  columnVisibility: Object.fromEntries(
    [
      "statusCode",
      "spanId",
      "traceId",
      "input_value",
      "output_value",
      "error",
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

vi.mock("../TraceFilterConditionField", () => ({
  TraceFilterConditionFieldWithVocabulary: () => null,
}));

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

import type { ProjectPageQueriesTracesQuery as ProjectPageTracesQueryType } from "../__generated__/ProjectPageQueriesTracesQuery.graphql";
import { ProjectPageQueriesTracesQuery } from "../ProjectPageQueries";
import { TraceFiltersProvider } from "../TraceFiltersContext";
import { TracesTable } from "../TracesTable";

const PROJECT_ID = tracingState.projectId;
const QUERY_TEXT = getRequest(ProjectPageQueriesTracesQuery).params.text ?? "";
/** The label the traces query gives each row's deferred child spans. */
const DESCENDANTS_DEFER_LABEL =
  /@defer\(label: "([^"]+_descendants[^"]*)"\)/.exec(QUERY_TEXT)?.[1];
/** The label the traces query gives the deferred annotation names. */
const NAMES_DEFER_LABEL = /@defer\(label: "([^"]+AnnotationNames[^"]*)"\)/.exec(
  QUERY_TEXT
)?.[1];
const NO_ANNOTATIONS = {
  spanAnnotations: [],
  summarySpanAnnotations: [],
  summarySpanAnnotationSummaries: [],
  documentRetrievalMetrics: [],
};

function makeRootSpanEdge(index: number) {
  const id = `Span:${index}`;
  return {
    rootSpan: {
      id,
      spanKind: "chain",
      name: `trace-${index}`,
      metadata: null,
      statusCode: "OK",
      statusMessage: "",
      startTime: "2026-07-01T12:00:00+00:00",
      endTime: "2026-07-01T12:00:01+00:00",
      latencyMs: 1000,
      cumulativeTokenCountTotal: 0,
      parentId: null,
      input: { value: "" },
      output: { value: "" },
      spanId: `span-id-${index}`,
      trace: {
        id: `Trace:${index}`,
        traceId: `trace-id-${index}`,
        userId: null,
        numSpans: 3,
        costSummary: { total: { cost: null } },
        summaryTraceAnnotations: [],
        summaryTraceAnnotationSummaries: [],
      },
      ...NO_ANNOTATIONS,
    },
    cursor: `cursor-${index}`,
    node: { __typename: "Span", id },
  };
}

function makeChildSpan(index: number, child: number) {
  return {
    id: `Span:${index}${child}`,
    spanKind: "llm",
    name: `child-${child}-of-trace-${index}`,
    statusCode: "OK",
    statusMessage: "",
    startTime: "2026-07-01T12:00:00+00:00",
    endTime: "2026-07-01T12:00:01+00:00",
    latencyMs: 500,
    parentId: `span-id-${index}`,
    cumulativeTokenCountTotal: 0,
    input: { value: "" },
    output: { value: "" },
    spanId: `span-id-${index}${child}`,
    trace: { id: `Trace:${index}`, traceId: `trace-id-${index}` },
    ...NO_ANNOTATIONS,
  };
}

function TableOwner({
  queryRef,
}: {
  queryRef: PreloadedQuery<ProjectPageTracesQueryType>;
}) {
  const data = usePreloadedQuery<ProjectPageTracesQueryType>(
    ProjectPageQueriesTracesQuery,
    queryRef
  );
  return (
    <TracesTable project={data.project} initialRequest={queryRef.source} />
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
  observers.clear();
  const environment = new Environment({
    network: Network.create(fetchRelay),
    store: new Store(new RecordSource()),
  });
  const queryRef = loadQuery<ProjectPageTracesQueryType>(
    environment,
    ProjectPageQueriesTracesQuery,
    { id: PROJECT_ID, timeRange: TIME_RANGE, traceFilterCondition: null }
  );
  await act(async () => {
    root.render(
      <ThemeProvider themeMode="light" disableBodyTheme>
        <PreferencesProvider>
          <RelayEnvironmentProvider environment={environment}>
            <MemoryRouter initialEntries={[`/projects/${PROJECT_ID}/traces`]}>
              <TraceFiltersProvider>
                <Suspense fallback="loading">
                  <TableOwner queryRef={queryRef} />
                </Suspense>
              </TraceFiltersProvider>
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

/** The name of each row, trace or child, top to bottom. */
function readRowNames() {
  return [...container.querySelectorAll("tbody tr a")].map(
    (link) => link.textContent
  );
}

/** Whether the load-more sentinel is in view; observers report it on observe. */
const sentinel = { isVisible: false };
const observers = new Set<MockIntersectionObserver>();
class MockIntersectionObserver {
  constructor(private callback: IntersectionObserverCallback) {}
  observe() {
    observers.add(this);
    queueMicrotask(() => this.report());
  }
  disconnect() {
    observers.delete(this);
  }
  report() {
    this.callback(
      [{ isIntersecting: sentinel.isVisible } as IntersectionObserverEntry],
      this as unknown as IntersectionObserver
    );
  }
}

async function setSentinelVisible(isVisible: boolean) {
  sentinel.isVisible = isVisible;
  await act(async () => observers.forEach((observer) => observer.report()));
}

function makeRowsPart({
  root,
  indexes,
  hasNextPage = false,
  withNames = root === "project",
}: {
  root: "project" | "node";
  indexes: number[];
  hasNextPage?: boolean;
  withNames?: boolean;
}) {
  return {
    data: {
      [root]: {
        __typename: "Project",
        id: PROJECT_ID,
        ...(root === "project" ? { name: "project" } : {}),
        evaluators: { edges: [] },
        configsByName: { edges: [] },
        rootSpans: {
          edges: indexes.map(makeRootSpanEdge),
          pageInfo: {
            endCursor: `cursor-${indexes[indexes.length - 1]}`,
            hasNextPage,
          },
        },
      },
    },
    hasNext: true,
    pending: [
      ...(withNames
        ? [{ id: "names", path: [root], label: NAMES_DEFER_LABEL }]
        : []),
      ...indexes.map((index, position) => ({
        id: `descendants-${index}`,
        path: [root, "rootSpans", "edges", position, "rootSpan"],
        label: DESCENDANTS_DEFER_LABEL,
      })),
    ],
  };
}

function makeChildSpansPart(indexes: number[], hasNext = true) {
  return {
    hasNext,
    incremental: indexes.map((index) => ({
      id: `descendants-${index}`,
      data: {
        descendants: {
          edges: [0, 1].map((child) => ({ node: makeChildSpan(index, child) })),
        },
      },
    })),
    completed: indexes.map((index) => ({ id: `descendants-${index}` })),
  };
}

function makeFailedChildSpansPart(indexes: number[]) {
  return {
    hasNext: false,
    completed: indexes.map((index) => ({
      id: `descendants-${index}`,
      errors: [{ message: "an unexpected error occurred" }],
    })),
  };
}

const NAMES_PART = {
  hasNext: true,
  incremental: [
    {
      id: "names",
      data: { spanAnnotationNames: [], traceAnnotationNames: [] },
    },
  ],
  completed: [{ id: "names" }],
};

/** Each trace row's name and whether it says its child spans failed to load. */
async function readFailedTraces() {
  // Expand every collapsed trace; an expanded one stays as it is.
  for (const button of container.querySelectorAll<HTMLButtonElement>(
    'tbody button[aria-label="Expand row"]'
  )) {
    if (button.querySelector('[data-expanded="true"]') == null) {
      await act(async () => button.click());
    }
  }
  const rows = [...container.querySelectorAll("tbody tr")];
  const failed: string[] = [];
  let trace: string | null = null;
  for (const row of rows) {
    const name = row.querySelector("a")?.textContent;
    if (name?.startsWith("trace-")) {
      trace = name;
    } else if (row.textContent === "Child spans failed to load." && trace) {
      failed.push(trace);
    }
  }
  return failed;
}

describe("TracesTable child span failures", () => {
  beforeEach(() => {
    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
    streamState.setFetchKey(0);
    sentinel.isVisible = false;
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows a refetch's new rows as loading, not failed, after an earlier failure", async () => {
    const load = createStreamingMultipartResponse();
    const refetch = createStreamingMultipartResponse();
    authFetchMock
      .mockResolvedValueOnce(load.response)
      .mockResolvedValueOnce(refetch.response);
    await renderTable();
    load.sendPart(makeRowsPart({ root: "project", indexes: [1, 2] }));
    load.sendPart(NAMES_PART);
    load.sendPart(makeFailedChildSpansPart([1, 2]));
    load.end();
    await settle();
    expect(await readFailedTraces()).toEqual(["trace-1", "trace-2"]);

    await act(async () => streamState.setFetchKey(1));
    refetch.sendPart(makeRowsPart({ root: "node", indexes: [3, 4] }));
    await settle();

    expect(authFetchMock).toHaveBeenCalledTimes(2);
    expect(readRowNames()).toEqual(["trace-3", "trace-4"]);
    expect(await readFailedTraces()).toEqual([]);
  });

  it("fails only the rows of a next page whose child spans failed", async () => {
    const load = createStreamingMultipartResponse();
    const secondPage = createStreamingMultipartResponse();
    const thirdPage = createStreamingMultipartResponse();
    authFetchMock
      .mockResolvedValueOnce(load.response)
      .mockResolvedValueOnce(secondPage.response)
      .mockResolvedValueOnce(thirdPage.response);
    await renderTable();
    load.sendPart(
      makeRowsPart({ root: "project", indexes: [1], hasNextPage: true })
    );
    load.sendPart(NAMES_PART);
    load.sendPart(makeChildSpansPart([1], false));
    load.end();
    await settle();

    await setSentinelVisible(true);
    secondPage.sendPart(
      makeRowsPart({ root: "node", indexes: [2], hasNextPage: true })
    );
    secondPage.sendPart(makeFailedChildSpansPart([2]));
    secondPage.end();
    await settle();
    await setSentinelVisible(false);
    await setSentinelVisible(true);
    thirdPage.sendPart(makeRowsPart({ root: "node", indexes: [3] }));
    await settle();

    expect(authFetchMock).toHaveBeenCalledTimes(3);
    expect(await readFailedTraces()).toEqual(["trace-2"]);
  });
});
