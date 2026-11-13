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

vi.mock("../SpanFilterConditionField", () => ({
  SpanFilterConditionField: () => null,
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
      traceAnnotationNames: [],
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
    { id: "0", data: { spanAnnotationNames: ["correctness", "note"] } },
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

/**
 * Opens the column selector and counts the failed states in it: an "error"
 * label that is not a column's own row, like the error column's.
 */
async function countColumnSelectorFailures() {
  const columnsButton = [...container.querySelectorAll("button")].find(
    (button) => button.textContent === "Columns"
  );
  await act(async () => {
    columnsButton?.click();
  });
  const popover = document.querySelector(".react-aria-Popover");
  return [...(popover?.querySelectorAll("*") ?? [])].filter(
    (element) =>
      element.children.length === 0 &&
      element.textContent === "error" &&
      element.closest("li") == null
  ).length;
}

describe("SpansTable span annotation names", () => {
  it("renders the rows before the names arrive", async () => {
    const stream = createStreamingMultipartResponse();
    authFetchMock.mockResolvedValueOnce(stream.response);
    await renderTable();
    stream.sendPart(ROWS_PART);
    await settle();

    expect(readRowNames()).toEqual(["span-1", "span-2"]);
    expect(readColumnHeaders()).not.toContain("correctness");

    stream.sendPart(NAMES_PART);
    stream.end();
    await settle();

    expect(readColumnHeaders()).toContain("correctness");
  });

  it.each([
    {
      failure: "a names part that reports errors",
      fail: (stream: ReturnType<typeof createStreamingMultipartResponse>) => {
        stream.sendPart({
          hasNext: false,
          completed: [
            { id: "0", errors: [{ message: "an unexpected error occurred" }] },
          ],
        });
        stream.end();
      },
    },
    {
      failure: "a response that ends before the names",
      fail: (stream: ReturnType<typeof createStreamingMultipartResponse>) =>
        stream.cutOff(),
    },
  ])("keeps the rows after $failure", async ({ fail }) => {
    const stream = createStreamingMultipartResponse();
    authFetchMock.mockResolvedValueOnce(stream.response);
    await renderTable();
    stream.sendPart(ROWS_PART);
    await settle();

    fail(stream);
    await settle();

    expect(readRowNames()).toEqual(["span-1", "span-2"]);
    expect(await countColumnSelectorFailures()).toBe(1);
  });
});
