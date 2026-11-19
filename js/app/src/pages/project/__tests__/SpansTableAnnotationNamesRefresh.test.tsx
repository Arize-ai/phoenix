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

describe("SpansTable annotation names on a refresh", () => {
  beforeEach(() => {
    streamState.setFetchKey(0);
  });

  it("shows the names as loading, not failed, while a refresh after a failure loads them", async () => {
    const load = createStreamingMultipartResponse();
    const refresh = createStreamingMultipartResponse();
    authFetchMock
      .mockResolvedValueOnce(load.response)
      .mockResolvedValueOnce(refresh.response);
    await renderTable();
    load.sendPart(ROWS_PART);
    load.sendPart({
      hasNext: false,
      completed: [
        { id: "0", errors: [{ message: "an unexpected error occurred" }] },
      ],
    });
    load.end();
    await settle();
    expect(await readColumnSelectorFailures()).toEqual([
      "Span annotation names failed to load.",
      "Trace annotation names failed to load.",
    ]);
    // the column selector toggles; close it before the refresh
    const columnsButton = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "Columns"
    );
    await act(async () => columnsButton?.click());
    expect(document.querySelector(".react-aria-Popover")).toBeNull();

    await act(async () => streamState.setFetchKey(1));
    refresh.sendPart({
      data: { node: ROWS_PART.data.project },
      hasNext: true,
      pending: [{ id: "0", path: ["node"], label: DEFER_LABEL }],
    });
    await settle();

    expect(authFetchMock).toHaveBeenCalledTimes(2);
    expect(await readColumnSelectorFailures()).toEqual([]);
  });
});
