import { act, Suspense } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  graphql,
  RelayEnvironmentProvider,
  useLazyLoadQuery,
} from "react-relay";
import { MemoryRouter } from "react-router";
import { createMockEnvironment, MockPayloadGenerator } from "relay-test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { installTestMatchMedia } from "@phoenix/__tests__/installTestMatchMedia";
import type * as DateTimeModule from "@phoenix/components/datetime";
import type * as PhoenixTableModule from "@phoenix/components/table";
import { ThemeProvider } from "@phoenix/contexts";
import { PreferencesProvider } from "@phoenix/contexts/PreferencesContext";

import type { TracesTableChildSpanDetailsTestQuery } from "./__generated__/TracesTableChildSpanDetailsTestQuery.graphql";

installTestMatchMedia();

const TIME_RANGE = {
  start: "2026-07-01T00:00:00.000Z",
  end: "2026-07-02T00:00:00.000Z",
};

const tracingState = vi.hoisted(() => ({
  annotationColumnVisibility: {},
  columnOrder: [],
  columnSizing: {},
  columnVisibility: {},
  projectId: "project-1",
  setColumnOrder: vi.fn(),
  setColumnSizing: vi.fn(),
  traceAnnotationColumnVisibility: {},
}));

vi.mock("@phoenix/components/datetime", async (importOriginal) => ({
  ...(await importOriginal<typeof DateTimeModule>()),
  useTimeRange: () => ({ timeRangeISOStrings: TIME_RANGE }),
}));

vi.mock(
  "@phoenix/components/annotation/useProjectAnnotationConfigsByName",
  () => ({
    useProjectAnnotationConfigsByName: () => new Map(),
  })
);

vi.mock("@phoenix/contexts/StreamStateContext", () => ({
  useStreamState: () => ({ fetchKey: "initial" }),
}));

vi.mock("@phoenix/contexts/TracingContext", () => ({
  useTracingContext: (selector: (state: typeof tracingState) => unknown) =>
    selector(tracingState),
}));

vi.mock("@phoenix/pages/trace/TracePaginationContext", () => ({
  useTracePagination: () => null,
}));

vi.mock("@phoenix/components/table/useShiftClickRowSelection", () => ({
  useShiftClickRowSelection: () => ({ selectRow: vi.fn() }),
}));

vi.mock("@phoenix/components/table", async (importOriginal) => ({
  ...(await importOriginal<typeof PhoenixTableModule>()),
  useColumnOrder: () => ({
    getColumnOrderIndex: () => 0,
    leafColumnOrder: [],
    onVisibleColumnOrderChange: vi.fn(),
    visibleColumnOrder: [],
  }),
  useTableRowsExpanded: () => ({
    isExpanded: false,
    setIsExpanded: vi.fn(),
    tableProps: {},
  }),
}));

vi.mock("../TraceFilterConditionField", () => ({
  TraceFilterConditionFieldWithVocabulary: () => null,
}));

vi.mock("../SpanColumnSelector", () => ({
  SpanColumnSelector: () => null,
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

import { TraceFiltersProvider } from "../TraceFiltersContext";
import { TracesTable } from "../TracesTable";

const mockResolvers: MockPayloadGenerator.MockResolvers = {
  SpanConnection: (context) =>
    context.path?.includes("descendants") ? undefined : { edges: [{}, {}] },
  Span: (context) => {
    const traceNumber = Number(context.path?.[3]) + 1;
    if (context.path?.includes("descendants")) {
      return {
        id: `span-child-${traceNumber}`,
        spanId: `child-${traceNumber}`,
        parentId: `root-${traceNumber}`,
        name: `child span ${traceNumber}`,
        startTime: "2026-07-01T10:00:01.000Z",
        input: { value: `child span ${traceNumber} input` },
      };
    }
    return {
      id: `span-root-${traceNumber}`,
      spanId: `root-${traceNumber}`,
      parentId: null,
      name: `root span ${traceNumber}`,
      startTime: "2026-07-01T10:00:00.000Z",
      input: { value: `root span ${traceNumber} input` },
    };
  },
  Trace: (context) => ({
    numSpans: 2,
    traceId: `trace-${Number(context.path?.[3]) + 1}`,
  }),
};

function TracesTableTestRenderer() {
  const data = useLazyLoadQuery<TracesTableChildSpanDetailsTestQuery>(
    graphql`
      query TracesTableChildSpanDetailsTestQuery($timeRange: TimeRange!)
      @relay_test_operation {
        project: node(id: "project-1") {
          ...TracesTable_spans
        }
      }
    `,
    { timeRange: TIME_RANGE }
  );
  return <TracesTable project={data.project} />;
}

describe("TracesTable child span details", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("loads every expanded trace's child span inputs in one request", async () => {
    const environment = createMockEnvironment();
    await act(async () => {
      root.render(
        <RelayEnvironmentProvider environment={environment}>
          <ThemeProvider themeMode="light" disableBodyTheme>
            <PreferencesProvider>
              <MemoryRouter initialEntries={["/projects/project-1/traces"]}>
                <TraceFiltersProvider>
                  <Suspense fallback={null}>
                    <TracesTableTestRenderer />
                  </Suspense>
                </TraceFiltersProvider>
              </MemoryRouter>
            </PreferencesProvider>
          </ThemeProvider>
        </RelayEnvironmentProvider>
      );
    });
    await act(async () => {
      environment.mock.resolveMostRecentOperation((operation) =>
        MockPayloadGenerator.generate(operation, mockResolvers)
      );
    });
    expect(container.textContent).toContain("root span 1 input");
    expect(container.textContent).toContain("root span 2 input");
    expect(container.textContent).not.toContain("child span");

    const expandButtonSelector = 'button[aria-label="Expand row"]';
    await act(async () => {
      container
        .querySelectorAll<HTMLButtonElement>(expandButtonSelector)[0]
        ?.click();
    });
    await act(async () => {
      container
        .querySelectorAll<HTMLButtonElement>(expandButtonSelector)[1]
        ?.click();
    });
    expect(container.textContent).toContain("child span 1");
    expect(container.textContent).toContain("child span 2");
    expect(container.textContent).not.toContain("child span 1 input");
    expect(container.textContent).not.toContain("child span 2 input");

    const pendingOperationNames = environment.mock
      .getAllOperations()
      .map((operation) => operation.request.node.params.name);
    expect(pendingOperationNames).toEqual(["TracesTableChildSpanDetailsQuery"]);

    await act(async () => {
      environment.mock.resolveMostRecentOperation((operation) =>
        MockPayloadGenerator.generate(operation, mockResolvers)
      );
    });
    expect(container.textContent).toContain("child span 1 input");
    expect(container.textContent).toContain("child span 2 input");
    expect(environment.mock.getAllOperations()).toHaveLength(0);
  });
});
