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

async function renderTable({
  projectId = PROJECT_ID,
  environment = new Environment({
    network: Network.create(fetchRelay),
    store: new Store(new RecordSource()),
  }),
}: { projectId?: string; environment?: Environment } = {}) {
  const queryRef = loadQuery<ProjectPageSpansQueryType>(
    environment,
    ProjectPageQueriesSpansQuery,
    {
      id: projectId,
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

describe("SpansTable span annotation names", () => {
  it("shows the next project's names, not the last one's", async () => {
    const environment = new Environment({
      network: Network.create(fetchRelay),
      store: new Store(new RecordSource()),
    });
    const first = createStreamingMultipartResponse();
    authFetchMock.mockResolvedValueOnce(first.response);
    await renderTable({ environment });
    first.sendPart(ROWS_PART);
    first.sendPart(NAMES_PART);
    first.end();
    await settle();
    act(() => root.unmount());
    root = createRoot(container);

    const nextProjectId = "UHJvamVjdDoy";
    const next = createStreamingMultipartResponse();
    authFetchMock.mockResolvedValueOnce(next.response);
    await renderTable({ projectId: nextProjectId, environment });
    next.sendPart({
      ...ROWS_PART,
      data: { project: { ...ROWS_PART.data.project, id: nextProjectId } },
    });
    await settle();

    expect(readColumnHeaders()).not.toContain("correctness");
  });

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
    expect(await readColumnSelectorFailures()).toEqual([
      "Span annotation names failed to load.",
      "Trace annotation names failed to load.",
    ]);
  });
});

describe("SpansTable next page", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        observe() {}
        disconnect() {}
      }
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads the next page without the annotation names, which stay on screen", async () => {
    const load = createStreamingMultipartResponse();
    authFetchMock.mockResolvedValueOnce(load.response).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: {
            node: {
              ...ROWS_PART.data.project,
              spans: {
                edges: [makeSpanEdge(3)],
                pageInfo: { endCursor: "cursor-3", hasNextPage: false },
              },
            },
          },
        }),
        { headers: { "Content-Type": "application/json" } }
      )
    );
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
    load.sendPart(NAMES_PART);
    load.end();
    await settle();

    const loadMoreButton = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "Load More"
    );
    await act(async () => loadMoreButton?.click());
    await settle();

    expect(authFetchMock).toHaveBeenCalledTimes(2);
    const { query, variables } = JSON.parse(
      authFetchMock.mock.calls[1][1].body
    );
    expect(variables).toMatchObject({ after: "cursor-2" });
    expect(query).not.toContain("spanAnnotationNames");
    expect(readRowNames()).toEqual(["span-1", "span-2", "span-3"]);
    expect(readColumnHeaders()).toContain("correctness");
  });
});
