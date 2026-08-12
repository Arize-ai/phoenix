import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import type * as ReactRelayModule from "react-relay";
import { MemoryRouter, useLocation } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { installTestMatchMedia } from "@phoenix/__tests__/installTestMatchMedia";
import type * as DateTimeModule from "@phoenix/components/datetime";
import type * as PhoenixTableModule from "@phoenix/components/table";
import { ThemeProvider } from "@phoenix/contexts";

installTestMatchMedia();

const relayMocks = vi.hoisted(() => ({
  refetch: vi.fn(),
  usePaginationFragment: vi.fn(),
}));

const fieldMocks = vi.hoisted(() => ({
  props: null as null | {
    onValidCondition: (args: {
      condition: string;
      selectsRootSpansOnly: boolean | null;
      isInitialSettlement: boolean;
    }) => void;
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
  usePaginationFragment: relayMocks.usePaginationFragment,
}));

vi.mock("@phoenix/components/datetime", async (importOriginal) => ({
  ...(await importOriginal<typeof DateTimeModule>()),
  useTimeRange: () => timeRangeState,
}));

vi.mock(
  "@phoenix/pages/project/metrics/useProjectAnnotationConfigsByName",
  () => ({
    useProjectAnnotationConfigsByName: () => new Map(),
  })
);

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

vi.mock("../SpanFilterConditionField", async () => {
  const React = await import("react");
  return {
    SpanFilterConditionField: (props: NonNullable<typeof fieldMocks.props>) => {
      fieldMocks.props = props;
      return React.createElement("div", null, "filter field");
    },
  };
});

vi.mock("../SpanColumnSelector", () => ({
  SpanColumnSelector: () => null,
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

import type { SpansTable_spans$key } from "../__generated__/SpansTable_spans.graphql";
import type { SettledSpanFilterSeed } from "../spanFilterSeed";
import { SpansTable } from "../SpansTable";

// Seeds now reach the table settled: whoever preloads the rows either
// classified the condition or had it validated first.
const settledSeed: SettledSpanFilterSeed = {
  condition: "status_code == 'ERROR'",
  requiresServerValidation: false,
  rootSpansOnly: false,
};

describe("SpansTable seed loading integration", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    fieldMocks.props = null;
    probedSearch = "";
    relayMocks.refetch.mockReset();
    relayMocks.usePaginationFragment.mockReturnValue({
      data: {
        name: "integration project",
        spanAnnotationNames: [],
        spans: { edges: [] },
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

  function renderTable() {
    return act(async () => {
      root.render(
        <ThemeProvider themeMode="light" disableBodyTheme>
          <MemoryRouter
            initialEntries={["/projects/project-integration/spans"]}
          >
            <SpansTable
              project={{} as SpansTable_spans$key}
              seed={settledSeed}
            />
            <SearchProbe />
          </MemoryRouter>
        </ThemeProvider>
      );
    });
  }

  it("renders a settled seed without refetching", async () => {
    // The preload already carried this condition, so asking again would fetch
    // rows the table is holding.
    await renderTable();

    expect(container.querySelector("table")).not.toBeNull();
    expect(relayMocks.refetch).not.toHaveBeenCalled();
  });

  it("refetches when the user applies a different condition", async () => {
    await renderTable();

    await act(async () => {
      fieldMocks.props?.onValidCondition({
        condition: "span_kind == 'LLM'",
        selectsRootSpansOnly: false,
        isInitialSettlement: false,
      });
    });

    expect(relayMocks.refetch).toHaveBeenCalledTimes(1);
    expect(relayMocks.refetch.mock.calls[0]?.[0]).toMatchObject({
      filterCondition: "span_kind == 'LLM'",
    });
  });

  it("does not refetch when the applied condition is unchanged", async () => {
    await renderTable();

    await act(async () => {
      fieldMocks.props?.onValidCondition({
        condition: settledSeed.condition,
        selectsRootSpansOnly: settledSeed.rootSpansOnly,
        isInitialSettlement: false,
      });
    });

    expect(relayMocks.refetch).not.toHaveBeenCalled();
  });

  it("does not write the mount-time settlement to the URL param", async () => {
    // The field settles its seeded value as soon as it mounts. Persisting that
    // settlement would write this tab's default into the param the tabs
    // share, imposing it on the other tab -- the leak the seed resolvers'
    // `persistToUrl` flag exists to prevent.
    await renderTable();

    await act(async () => {
      fieldMocks.props?.onValidCondition({
        condition: settledSeed.condition,
        selectsRootSpansOnly: settledSeed.rootSpansOnly,
        isInitialSettlement: true,
      });
    });

    expect(probedSearch).not.toContain("spanFilterCondition");
  });

  it("writes a user-applied condition to the URL param", async () => {
    await renderTable();

    await act(async () => {
      fieldMocks.props?.onValidCondition({
        condition: "span_kind == 'LLM'",
        selectsRootSpansOnly: false,
        isInitialSettlement: false,
      });
    });

    expect(probedSearch).toContain("spanFilterCondition=span_kind");
  });
});

let probedSearch = "";
/** Records the router's current search so tests can observe param writes. */
function SearchProbe() {
  probedSearch = useLocation().search;
  return null;
}
