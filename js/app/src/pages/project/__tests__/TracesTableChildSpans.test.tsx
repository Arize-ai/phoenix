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

vi.mock("@phoenix/contexts/StreamStateContext", () => ({
  useStreamState: () => ({ fetchKey: 0 }),
}));

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
const TRACE_INDEXES = [1, 2];

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

/** The first part of the traces query's response: the trace rows only. */
const ROWS_PART = {
  data: {
    project: {
      __typename: "Project",
      id: PROJECT_ID,
      name: "project",
      evaluators: { edges: [] },
      configsByName: { edges: [] },
      rootSpans: {
        edges: TRACE_INDEXES.map(makeRootSpanEdge),
        pageInfo: { endCursor: "cursor-2", hasNextPage: false },
      },
    },
  },
  hasNext: true,
  pending: [
    { id: "names", path: ["project"], label: NAMES_DEFER_LABEL },
    ...TRACE_INDEXES.map((index, position) => ({
      id: `descendants-${index}`,
      path: ["project", "rootSpans", "edges", position, "rootSpan"],
      label: DESCENDANTS_DEFER_LABEL,
    })),
  ],
};

const CHILD_SPANS_PART = {
  hasNext: true,
  incremental: TRACE_INDEXES.map((index) => ({
    id: `descendants-${index}`,
    data: {
      descendants: {
        edges: [0, 1].map((child) => ({ node: makeChildSpan(index, child) })),
      },
    },
  })),
  completed: TRACE_INDEXES.map((index) => ({ id: `descendants-${index}` })),
};

const NAMES_PART = {
  hasNext: false,
  incremental: [
    {
      id: "names",
      data: { spanAnnotationNames: [], traceAnnotationNames: [] },
    },
  ],
  completed: [{ id: "names" }],
};

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

async function expandAllRows() {
  const buttons = [
    ...container.querySelectorAll<HTMLButtonElement>(
      'tbody button[aria-label="Expand row"]'
    ),
  ];
  for (const button of buttons) {
    await act(async () => button.click());
  }
  return buttons.length;
}

describe("TracesTable child spans", () => {
  it("renders the trace rows before their child spans arrive", async () => {
    const stream = createStreamingMultipartResponse();
    authFetchMock.mockResolvedValueOnce(stream.response);
    await renderTable();
    stream.sendPart(ROWS_PART);
    await settle();

    expect(readRowNames()).toEqual(["trace-1", "trace-2"]);

    stream.sendPart(CHILD_SPANS_PART);
    stream.sendPart(NAMES_PART);
    stream.end();
    await settle();

    expect(await expandAllRows()).toBe(2);
    expect(readRowNames()).toEqual([
      "trace-1",
      "child-0-of-trace-1",
      "child-1-of-trace-1",
      "trace-2",
      "child-0-of-trace-2",
      "child-1-of-trace-2",
    ]);
  });

  it.each([
    {
      failure: "a child spans part that reports errors",
      fail: (stream: ReturnType<typeof createStreamingMultipartResponse>) => {
        stream.sendPart({
          hasNext: false,
          completed: TRACE_INDEXES.map((index) => ({
            id: `descendants-${index}`,
            errors: [{ message: "an unexpected error occurred" }],
          })),
        });
        stream.end();
      },
    },
    {
      failure: "a response that ends before the child spans",
      fail: (stream: ReturnType<typeof createStreamingMultipartResponse>) =>
        stream.cutOff(),
    },
  ])(
    "keeps the trace rows and says their child spans failed to load after $failure",
    async ({ fail }) => {
      const stream = createStreamingMultipartResponse();
      authFetchMock.mockResolvedValueOnce(stream.response);
      await renderTable();
      stream.sendPart(ROWS_PART);
      await settle();

      fail(stream);
      await settle();

      expect(readRowNames()).toEqual(["trace-1", "trace-2"]);
      expect(await expandAllRows()).toBe(2);
      // The message is the row's only content: not a link to a span, and no
      // span cells such as input, output or cost beside it.
      const failedRows = [
        ...container.querySelectorAll("tbody tr[data-is-additional-row]"),
      ];
      expect(failedRows.map((row) => row.textContent)).toEqual([
        "Child spans failed to load.",
        "Child spans failed to load.",
      ]);
      expect(failedRows.map((row) => row.querySelector("a"))).toEqual([
        null,
        null,
      ]);
      expect(
        failedRows.map((row) => row.querySelectorAll("td").length)
      ).toEqual([1, 1]);
    }
  );
});
