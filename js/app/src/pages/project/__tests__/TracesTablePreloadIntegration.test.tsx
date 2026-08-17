import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import type * as ReactRelayModule from "react-relay";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { installTestMatchMedia } from "@phoenix/__tests__/installTestMatchMedia";
import type * as DateTimeModule from "@phoenix/components/datetime";
import type * as PhoenixTableModule from "@phoenix/components/table";
import { ThemeProvider } from "@phoenix/contexts";

installTestMatchMedia();

const relayMocks = vi.hoisted(() => ({
  refetch: vi.fn(),
  useLazyLoadQuery: vi.fn(),
  usePaginationFragment: vi.fn(),
}));

const fieldMocks = vi.hoisted(() => ({
  props: null as null | {
    onValidCondition: (condition: string) => void;
  },
}));

const tracingState = vi.hoisted(() => ({
  annotationColumnVisibility: {},
  columnOrder: [],
  columnSizing: {},
  columnVisibility: {},
  projectId: "project-integration",
  setColumnOrder: vi.fn(),
  setColumnSizing: vi.fn(),
  traceAnnotationColumnVisibility: {},
}));

const timeRangeState = vi.hoisted(() => ({
  timeRangeISOStrings: {
    start: "2026-07-01T00:00:00.000Z",
    end: "2026-07-02T00:00:00.000Z",
  },
}));

vi.mock("react-relay", async (importOriginal) => ({
  ...(await importOriginal<typeof ReactRelayModule>()),
  useLazyLoadQuery: relayMocks.useLazyLoadQuery,
  usePaginationFragment: relayMocks.usePaginationFragment,
}));

vi.mock("@phoenix/components/datetime", async (importOriginal) => ({
  ...(await importOriginal<typeof DateTimeModule>()),
  useTimeRange: () => timeRangeState,
}));

vi.mock("@phoenix/contexts/StreamStateContext", () => ({
  useStreamState: () => ({ fetchKey: 0 }),
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

vi.mock("../TraceFilterConditionField", async () => {
  const React = await import("react");
  return {
    TraceFilterConditionField: (
      props: NonNullable<typeof fieldMocks.props>
    ) => {
      fieldMocks.props = props;
      return React.createElement("div", null, "filter field");
    },
  };
});

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

import type { TracesTable_spans$key } from "../__generated__/TracesTable_spans.graphql";
import { TraceFiltersProvider } from "../TraceFiltersContext";
import { TracesTable } from "../TracesTable";

describe("TracesTable preload integration", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    fieldMocks.props = null;
    relayMocks.refetch.mockReset();
    relayMocks.useLazyLoadQuery.mockReturnValue({
      project: { traceFilterVocabulary: [] },
    });
    relayMocks.usePaginationFragment.mockReturnValue({
      data: {
        id: "project-integration",
        name: "integration project",
        rootSpans: { edges: [] },
      },
      hasNext: false,
      isLoadingNext: false,
      loadNext: vi.fn(),
      refetch: relayMocks.refetch,
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("keeps preloaded rows until a filter input changes", async () => {
    await act(async () => {
      root.render(
        <ThemeProvider themeMode="light" disableBodyTheme>
          <MemoryRouter
            initialEntries={["/projects/project-integration/traces"]}
          >
            <TraceFiltersProvider>
              <TracesTable project={{} as TracesTable_spans$key} />
            </TraceFiltersProvider>
          </MemoryRouter>
        </ThemeProvider>
      );
    });

    expect(container.querySelector("table")).not.toBeNull();
    expect(relayMocks.refetch).not.toHaveBeenCalled();

    await act(async () => {
      fieldMocks.props?.onValidCondition("num_spans >= 5");
    });

    expect(relayMocks.refetch).toHaveBeenCalledTimes(1);
    expect(relayMocks.refetch.mock.calls[0]?.[0]).toMatchObject({
      traceFilterCondition: "num_spans >= 5",
    });
  });
});
