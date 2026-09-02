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
  "@phoenix/components/annotation/useProjectAnnotationConfigsByName",
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

vi.mock("@phoenix/pages/trace/SessionPaginationContext", () => ({
  useSessionPagination: () => null,
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

vi.mock("../SessionFilterConditionField", async () => {
  const React = await import("react");
  return {
    SessionFilterConditionFieldWithVocabulary: (
      props: NonNullable<typeof fieldMocks.props>
    ) => {
      fieldMocks.props = props;
      return React.createElement("div", null, "filter field");
    },
  };
});

vi.mock("../SessionColumnSelector", () => ({
  SessionColumnSelector: () => null,
}));

vi.mock("../SessionsTableAside", () => ({
  SessionsTableAside: () => null,
}));

vi.mock("../SessionsTableEmpty", () => ({
  SessionsTableEmpty: () => null,
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

import type { SessionsTable_sessions$key } from "../__generated__/SessionsTable_sessions.graphql";
import { SessionFiltersProvider } from "../SessionFiltersContext";
import { SessionsTable } from "../SessionsTable";

// Seeds reach the table settled: whoever preloads the rows either classified
// the condition or had it validated first.
const seed = "num_traces >= 5";

describe("SessionsTable preload integration", () => {
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
        id: "project-integration",
        name: "integration project",
        sessions: { edges: [] },
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
            initialEntries={[
              `/projects/project-integration/sessions?sessionFilterCondition=${encodeURIComponent(seed)}`,
            ]}
          >
            <SessionFiltersProvider>
              <SessionsTable
                project={{} as SessionsTable_sessions$key}
                seed={seed}
              />
            </SessionFiltersProvider>
            <SearchProbe />
          </MemoryRouter>
        </ThemeProvider>
      );
    });
  }

  it("keeps preloaded rows through the seed's own mount settlement", async () => {
    // The preload already carried this condition. The field settles it again
    // when it mounts, and asking for the rows again would fetch what the
    // table is holding -- and swap in unfiltered rows in the meantime if the
    // applied condition had started out empty.
    await renderTable();

    expect(container.querySelector("table")).not.toBeNull();

    await act(async () => {
      fieldMocks.props?.onValidCondition({
        condition: seed,
        isInitialSettlement: true,
      });
    });

    expect(relayMocks.refetch).not.toHaveBeenCalled();
    expect(probedSearch).toBe(
      `?sessionFilterCondition=${encodeURIComponent(seed)}`
    );
  });

  it("refetches when the user applies a different condition", async () => {
    await renderTable();

    await act(async () => {
      fieldMocks.props?.onValidCondition({
        condition: "num_traces >= 10",
        isInitialSettlement: false,
      });
    });

    expect(relayMocks.refetch).toHaveBeenCalledTimes(1);
    expect(relayMocks.refetch.mock.calls[0]?.[0]).toMatchObject({
      sessionFilterCondition: "num_traces >= 10",
    });
    expect(probedSearch).toContain("sessionFilterCondition=num_traces");
  });

  it("deletes the URL param when the user clears the condition", async () => {
    await renderTable();

    await act(async () => {
      fieldMocks.props?.onValidCondition({
        condition: "",
        isInitialSettlement: false,
      });
    });

    expect(relayMocks.refetch.mock.calls[0]?.[0]).toMatchObject({
      sessionFilterCondition: null,
    });
    expect(probedSearch).not.toContain("sessionFilterCondition");
  });
});

let probedSearch = "";
/** Records the router's current search so tests can observe param writes. */
function SearchProbe() {
  // eslint-disable-next-line react/globals
  probedSearch = useLocation().search;
  return null;
}
